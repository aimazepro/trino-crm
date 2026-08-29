# Painel Admin de Workspaces — Design

**Data:** 2026-08-29
**Status:** Aprovado para plano de implementação

## 1. Visão geral

Hoje o TrinoCRM não tem nenhum conceito de "operador da plataforma" — só papéis
*dentro* de um workspace (`admin`/`gerente`/`vendedor`, ver
[`src/lib/workspace-context.ts`](../../../src/lib/workspace-context.ts)). Não
existe forma de:

- listar todos os workspaces existentes;
- criar um workspace + conta do dono manualmente, sem o fluxo de convite;
- suspender/reativar/apagar um workspace de fora;
- ligar/desligar features por workspace (ex: cliente não contratou VoIP);
- ver uso/gasto real de um workspace sem entrar nele.

Este projeto adiciona um painel interno (`/admin`) e uma API REST
(`/api/admin/*`) para cobrir os cinco pontos acima. É a base de operação da
TrinoCRM como agência que revende o CRM pros próprios clientes — mesmo rumo
de "virar SaaS multi-tenant" já registrado como meta do projeto, com
`docs/BACKLOG.md` como fonte única do que falta em torno disso.

## 2. Não-objetivos (v1)

- **Sem Stripe / cobrança real.** `billing/page.tsx` já é mock hoje; continua
  mock. O painel admin mostra *uso*, não processa pagamento. Cobrança real é
  item separado no `docs/BACKLOG.md` (linha ~445, "Stripe por trás da tela").
- **Sem hard-delete.** Apagar workspace pelo painel é sempre soft
  (`status='deleted'`), nunca um `DELETE FROM workspaces` de verdade. Purga
  definitiva de dados fica fora de escopo — é irreversível e não foi pedida.
- **Sem tabela de múltiplos admins.** Acesso é allowlist fixa por e-mail via
  env var. Suportar vários operadores da plataforma com papéis distintos é
  extensão futura, não v1.
- **Sem enforcement de feature flag em toda a superfície do produto.** V1 liga
  o mecanismo de verdade (não cosmético) em 3 áreas: WhatsApp, VoIP/telefonia,
  Automações. Estender pra outras chaves (ex: `api_v1`, `custom_fields`) é o
  mesmo padrão, mas é trabalho futuro.

## 3. Modelo de dados

Migração nova (`supabase/migrations/20260829XXXXXX_platform_admin_workspace_controls.sql`):

```sql
alter table public.workspaces
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  add column feature_flags jsonb not null default '{}'::jsonb;

create index workspaces_status_idx on public.workspaces (status);
```

Nada muda em `workspace_members`. Nenhuma tabela nova — allowlist de admin é
env var, não linha de banco (ver §4).

`feature_flags` guarda só **overrides** (chave ausente = usa o default do
plano). Ex.: `{"voip": false}` desliga VoIP nesse workspace mesmo em plano que
normalmente teria.

## 4. Autenticação e acesso

Novo arquivo `src/lib/platform-admin.ts`:

```ts
export interface PlatformAdminContext {
  via: "session" | "token";
  email: string | null;
}

export async function getPlatformAdmin(
  request: Request,
  supabase: SupabaseClient<Database>
): Promise<PlatformAdminContext | null>
```

Lógica, nesta ordem:

1. **Sessão de navegador** — `supabase.auth.getUser()`; se o e-mail (lowercase,
   trim) está em `PLATFORM_ADMIN_EMAILS` (env, lista separada por vírgula) →
   admin via `"session"`.
2. **Bearer token** — header `Authorization: Bearer <token>` comparado
   (`crypto.timingSafeEqual`, não `===`, para não vazar timing) contra
   `PLATFORM_ADMIN_API_TOKEN` (env, secret novo, gerado do mesmo jeito que
   `AUTOMATION_DISPATCH_SECRET`) → admin via `"token"`, `email: null`.
3. Nenhum dos dois → `null`.

Duas env vars novas em `.env.example`, seguindo o padrão de comentário já
usado no arquivo:

```
# --- Painel admin da plataforma (super-admin) -----------------------------
# OBRIGATÓRIA para acessar /admin. Lista de e-mails separados por vírgula.
PLATFORM_ADMIN_EMAILS=
# OBRIGATÓRIA para chamar /api/admin/* via script/curl (Authorization: Bearer).
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PLATFORM_ADMIN_API_TOKEN=
```

Ambas entram em `src/lib/env.ts` na lista de obrigatórias (mesmo mecanismo que
já derruba o boot com erro claro se faltar — Fase 0 item 3).

**UI (`/admin/**`)** fica dentro do matcher padrão do proxy — sessão já
resolve (você tem `workspace_members` própria, não é machine caller). O
`layout.tsx` de `/admin` chama `getPlatformAdmin` e devolve **404** (via
`notFound()`), não 403, pra quem não é admin — não expõe que a rota existe.

**API (`/api/admin/**`)** entra na lista de exclusões do matcher do proxy —
mesmo motivo que `api/v1` já está lá: sem isso, uma chamada via
`PLATFORM_ADMIN_API_TOKEN` sem cookie de sessão bate no redirect de
`/login` do proxy, que um script lê como 307-sucesso e nunca repete (a
armadilha documentada no cabeçalho do próprio `proxy.ts`, já custou 3
incidentes). Cada rota chama `getPlatformAdmin` internamente e devolve
`401`/`403` JSON, igual o padrão de `authenticateApiRequest` em
`src/lib/api-auth.ts`.

## 5. API admin

Todas em `src/app/api/admin/workspaces/`, service-role (`createAdminClient`,
mesmo padrão inline já usado em `src/lib/whatsapp/connection.ts` e
`src/lib/telephony/db.ts` — bypassa RLS de propósito, é o único jeito de ver
entre workspaces). Respostas usam `apiSuccess`/`apiError` de
`src/lib/api-auth.ts` (reaproveitado, não duplicado).

| Rota | Método | Faz |
|---|---|---|
| `/api/admin/workspaces` | GET | Lista: id, name, slug, plan, status, contagem de membros, `created_at`, `trial_ends_at`. Filtros por query string: `status`, `plan`, `q` (busca em name/slug). |
| `/api/admin/workspaces` | POST | Cria workspace + dono. Body: `{name, slug, plan, owner_email, owner_password}`. Ver fluxo abaixo. |
| `/api/admin/workspaces/:id` | GET | Detalhe + bloco de uso (§7). |
| `/api/admin/workspaces/:id` | PATCH | Parcial: `name`, `slug`, `plan`, `status`, `feature_flags` (merge raso, não substitui o objeto inteiro). |
| `/api/admin/workspaces/:id` | DELETE | `status='deleted'` (soft). Idempotente — chamar de novo não é erro. |

**Fluxo do POST (criar workspace + dono):**

1. Valida `owner_email` (formato) e `owner_password` (mínimo 8 caracteres —
   mesma régua do Supabase Auth default).
2. `admin.auth.admin.createUser({ email, password, email_confirm: true })`.
   Se o Supabase devolver erro de e-mail já cadastrado (`email_exists` /
   mensagem "already been registered") → `409 EMAIL_EXISTS`, mensagem clara
   pra não confundir com erro de validação. Adicionar usuário existente a um
   workspace novo fica fora de escopo v1 — não é o pedido ("criar conta").
3. Insere `workspaces` (`owner_user_id` = uuid do usuário criado, `plan`
   default `trial` se omitido, `status='active'`).
4. Insere `workspace_members` (`workspace_id`, `member_user_id` = mesmo uuid,
   `email`, `role='admin'`, `status='accepted'`, `accepted_at=now()`) — mesmo
   padrão de "dono seedado como admin/accepted" já usado no resto do app
   (`docs/BACKLOG.md` linha 213-214).
5. Se o passo 3 ou 4 falhar depois do `createUser` ter sucesso, a rota
   **apaga o usuário criado** (`admin.auth.admin.deleteUser`) antes de
   devolver erro — não deixa um `auth.users` órfão sem workspace.
6. `slug` duplicado → `409 SLUG_TAKEN` (checagem antes do `createUser`, pra
   não criar usuário à toa).

## 6. Corte de acesso real (status ≠ active)

`src/proxy.ts` já faz, a cada request autenticada, um `select` em
`workspace_members` pra decidir se a sessão continua viva (comentário no
próprio arquivo, linhas 12-18). Esse bloco ganha mais uma condição: junto
checar `workspaces.status`. Se o workspace do membro está `suspended` ou
`deleted`, mesmo fluxo que já existe pra membro removido — `signOut()` +
redirect `/login?revoked=1` + limpeza de cookie `sb-*`. Mesmo espírito do
fix em `03254af` (cortar acesso de member), agora um nível acima.

## 7. Uso e gasto (sem Stripe)

Bloco `usage` no `GET /api/admin/workspaces/:id`, todas as queries via
service-role, sem tabela nova:

- **Membros:** `count(*)` de `workspace_members` por status.
- **Telefonia (único gasto em R$ real hoje):** `telephony_balances`
  (`balance_cents`, `reserved_cents`) + últimas 10 linhas de
  `telephony_ledger` (extrato).
- **WhatsApp:** `count(*)` de `whatsapp_messages` nos últimos 30 dias.
- **Atividade:** `count(*)` de `deals`, e `max(created_at)` entre
  `deal_history`/`contact_history` como "última atividade" (sinal de
  workspace vivo vs. abandonado).
- **Plano/trial:** `plan`, `trial_ends_at`, `status` (já vêm do próprio
  `workspaces`).

## 8. Feature flags

`src/lib/feature-flags.ts` — registro estático, sem tabela:

```ts
export type FeatureKey = "whatsapp" | "voip" | "automacoes" | "api_v1" | "custom_fields";

const PLAN_DEFAULTS: Record<string, Record<FeatureKey, boolean>> = {
  trial:    { whatsapp: true, voip: false, automacoes: true,  api_v1: true, custom_fields: true },
  pro:      { whatsapp: true, voip: true,  automacoes: true,  api_v1: true, custom_fields: true },
  business: { whatsapp: true, voip: true,  automacoes: true,  api_v1: true, custom_fields: true },
};

export function effectiveFeatures(
  plan: string,
  overrides: Partial<Record<FeatureKey, boolean>>
): Record<FeatureKey, boolean>
```

`plan` desconhecido cai no default de `trial` (mais restritivo, nunca abre
mais do que deveria por engano).

**Enforcement de verdade (v1 — 3 áreas):**

| Feature | Gate de UI | Gate de API |
|---|---|---|
| `whatsapp` | topo de `src/app/conversas/page.tsx` | rotas de envio em `src/app/api/whatsapp/*` (não a `webhook`, que é a Evolution API postando pra dentro) |
| `voip` | topo de `src/app/configuracoes/telefone/page.tsx` | `src/app/api/telephony/token`, `.../calls` (iniciar chamada) |
| `automacoes` | já existe `RequireCapability` em `src/app/automacoes/page.tsx` — soma um `RequireFeature` no mesmo wrapper | mutações em `automacoes-context.tsx` (que chamam Supabase direto, não rota própria) — checagem entra ali antes do insert/update |

Componente novo `src/components/auth/require-feature.tsx`, mesmo formato do
`RequireCapability` (mesma mensagem "sem acesso" reaproveitada como base).
Precisa de `feature_flags` e `plan` chegando no client: `WorkspaceInfo`
(`src/lib/workspace-context.ts`) ganha um campo `features: Record<FeatureKey, boolean>`
computado no próprio `getWorkspaceContext` (um select a mais, mesma função,
sem quebrar quem já consome `workspaceId`/`role`/`userId`).

Do lado servidor: `assertFeatureEnabled(supabase, workspaceId, key)` em
`src/lib/feature-flags.ts`, devolve `403 FEATURE_DISABLED` via `apiError`
quando desligado — usado nas rotas de API listadas acima.

## 9. UI

- **`/admin`** — tabela de workspaces (nome, slug, plano, status, membros,
  criado em), busca por nome/slug, filtro por status/plano, botão "Criar
  workspace" (abre modal com o form do POST).
- **`/admin/[id]`** — nome/slug/plano editáveis inline, botões
  ativar/suspender/apagar (com confirmação — apagar e suspender cortam acesso
  na hora, conforme §6), toggles de `feature_flags` (uma linha por
  `FeatureKey`), bloco de uso (§7) somente leitura, lista de membros somente
  leitura (edição de membro continua em `/configuracoes/usuarios`, dentro do
  próprio workspace — não duplica).

Visual: reaproveita os componentes/estilo já usados em
`configuracoes/usuarios/page.tsx` e `configuracoes/empresa/page.tsx` (tabela,
badges de status, botões) — é ferramenta interna, não precisa de direção
visual nova.

## 10. Segurança

- Service-role key nunca sai do server (mesma regra que já vale pro resto do
  código — `SUPABASE_SERVICE_ROLE_KEY` só em Route Handlers).
- `PLATFORM_ADMIN_API_TOKEN` comparado com `timingSafeEqual`, não `===`.
- `/admin/**` devolve 404 pra não-admin (não 403) — não confirma a existência
  da rota pra quem não tem acesso.
- Toda ação de escrita (`POST`/`PATCH`/`DELETE`) em `/api/admin/*` fica em log
  (`console.log` estruturado com `via`, `email` ou `"token"`, ação, workspace
  alvo) — auditoria mínima, sem tabela nova, mesmo nível de esforço do resto
  do projeto hoje.
- `owner_password` nunca é logado nem devolvido na resposta do POST.

## 11. Testes

- Migração: roda em branch Supabase antes de aplicar em prod (padrão já
  usado no projeto).
- `getPlatformAdmin`: cobre os 3 caminhos (sessão válida, token válido, nem
  um nem outro) + e-mail com case/espaço diferente ainda casa.
- POST criar workspace: caminho feliz, e-mail duplicado (409), slug duplicado
  (409), falha no passo 3/4 limpa o usuário criado (não fica órfão).
- `effectiveFeatures`: override `false` vence default `true` e vice-versa;
  plano desconhecido cai em `trial`.
- Proxy: sessão de membro de workspace `suspended`/`deleted` é derrubada no
  próximo request (mesmo teste que já existe pro membro removido, estendido).
- `/api/admin/*` sem sessão e sem token → 401; com sessão de não-admin → 401
  (não 403, pra não vazar "essa rota existe mas você não pode").

## 12. Ordem de implementação

1. Migração (`status` + `feature_flags` em `workspaces`).
2. `src/lib/platform-admin.ts` + env vars + `src/lib/env.ts`.
3. Exclusão de `api/admin` no matcher do `proxy.ts` + extensão do check de
   `status` (§6) — esses dois primeiro porque tudo depois depende deles.
4. API admin (`GET`/`POST`/`PATCH`/`DELETE` de workspaces).
5. `src/lib/feature-flags.ts` + extensão de `WorkspaceInfo`/`getWorkspaceContext`.
6. `RequireFeature` + os 3 pontos de enforcement (§8).
7. UI `/admin` e `/admin/[id]`.
8. Atualizar `docs/BACKLOG.md` marcando o item como feito.
