# Painel da plataforma v2 — o que ficou faltando

**Estado:** código completo e revisado, 25 commits, mergeado na `main` em 2026-09-02.
**Design:** [`docs/superpowers/specs/2026-08-30-painel-plataforma-design.md`](superpowers/specs/2026-08-30-painel-plataforma-design.md)
**Plano executado:** [`docs/superpowers/plans/2026-08-30-painel-plataforma-v2.md`](superpowers/plans/2026-08-30-painel-plataforma-v2.md)

O painel está no ar em **https://admin.aimaze.com.br** desde 2026-09-02.

O que resta não bloqueia o acesso: o toggle de sign-ups no Supabase (§1.2), um risco a fechar antes
de existir um segundo operador (§2), uma verificação que precisa de navegador (§3) e dívida
registrada (§4).

---

## 1. Bloqueia produção — só o dono faz

### 1.1 DNS + domínio na Vercel — ✅ **RESOLVIDO em 2026-09-02**

O painel está no ar em **https://admin.aimaze.com.br**.

O que faltava era só o registro de DNS; o domínio já estava atribuído ao projeto na Vercel e
`NEXT_PUBLIC_ADMIN_HOST` já estava definida em Production. Criado:

```
CNAME  admin.aimaze.com.br  ->  cname.vercel-dns.com   (proxy DESLIGADO, nuvem cinza)
```

**O proxy da Cloudflare ficou desligado de propósito**, diferente de `api-crm` (que está proxied).
O roteamento do painel depende de ler `x-forwarded-host` em `src/proxy.ts` para decidir qual host
é qual — pôr a Cloudflare na frente mexe justamente nessa camada de cabeçalhos. Está funcionando
sem proxy; se um dia quiser ligar a nuvem laranja para ganhar cache/DDoS, ligue e **reteste as três
rotas abaixo antes de considerar feito**, porque é exatamente o mecanismo que pode quebrar em
silêncio.

Verificado em produção logo depois de criar o registro:

| Host | Caminho | Resposta |
|---|---|---|
| painel | `/` | 307 → `/entrar` |
| painel | `/entrar` | 200, renderiza "Painel da Plataforma / Acesso restrito a operadores" |
| painel | `/contas`, `/auditoria` | 307 → `/entrar` (gate funcionando) |
| CRM | `/login` | 200 (intacto) |
| CRM | `/painel/contas` | 404 (isolamento vale em produção) |
| CRM | `/admin` | 307 → `https://admin.aimaze.com.br/` |

**Em dev**, o painel continua em `painel.localhost:3000` — depende de `NEXT_PUBLIC_ADMIN_HOST`
estar no `.env.local`. Se um clone novo não tiver essa variável, o host do painel é tratado como
CRM e `/entrar` cai no `/login` do cliente; foi exatamente o que aconteceu no repositório principal
até 2026-09-02.

### 1.2 Desligar sign-ups no Supabase

Supabase → Authentication → Providers → Email → desmarcar **"Enable sign-ups"** → Save.

O botão de cadastro sumiu da UI e `supabase.auth.signUp` não existe mais em lugar nenhum do
repositório, mas **a trava de verdade é esse toggle**: até desmarcá-lo, `POST /auth/v1/signup`
continua aberto para quem souber chamá-lo direto.

Depois de desligar, saiba que: um login com Google de e-mail **desconhecido** também passa a ser
recusado (o disable-signup do GoTrue vale para OAuth). É o desejado — só não seja pego de surpresa.

Verificado ao escrever o plano: `/api/convites/aceitar` cria o usuário com `admin.createUser`
(service-role), então **desligar o toggle não quebra convite**. Vale testar um convite de ponta a
ponta depois de desligar, mesmo assim.

---

## 2. Risco conhecido — corrigir ANTES de criar o segundo operador

**Um `support` consegue banir a conta do `owner` com um clique.**

A tela `/contas` mostra um botão Bloquear em toda conta órfã, e contas de operador da plataforma
são órfãs por desenho (não são membros de workspace nenhum). O `PATCH /api/admin/accounts/[id]`
só recusa auto-bloqueio (`SELF_BLOCK`); não recusa bloquear *outro operador*.

- **Hoje é inalcançável**: existe um operador só (`tools@trinocompany.com.br`) e não há UI para
  criar outro — operador novo entra por SQL.
- **É reversível**: limpar `banned_until` no dashboard do Supabase.
- **Vira alcançável no minuto em que houver um segundo operador.**

**Correção:** portar para o `PATCH` as três checagens que o `DELETE` da mesma rota e o
`POST /api/admin/impersonate` já fazem — recusar quando o alvo tem linha em `platform_admins`
(independente do status) ou bate em `PLATFORM_ADMIN_EMAILS`. Ver
`src/app/api/admin/impersonate/route.ts` para o formato e o comentário.

---

## 3. Não verificado (precisa de humano com navegador)

**A faixa âmbar do impersonate nunca foi vista renderizada.** É um componente de cliente que lê
`document.cookie` num `useEffect`, então não aparece em HTML servido por `curl`, e os dois MCPs de
Playwright do ambiente de desenvolvimento dependiam de uma extensão que sequestrava a aba.

Todo o resto do fluxo foi verificado ao vivo: a rota recusa alvo que é operador (403), recusa uuid
malformado (400), a recusa não gera linha de auditoria, e o caminho feliz devolve URL no host do
CRM com o cookie `impersonated_by` de `Max-Age=34560000` sem `HttpOnly`.

Roteiro de clique:
1. No painel, abrir uma conta e clicar "Entrar como" num membro real.
2. Na aba nova, confirmar a faixa âmbar no topo — "SESSÃO DE SUPORTE — você está como fulano@…" —
   e que ela continua em `/`, `/negocios` e `/contatos`.
3. Clicar "sair": volta para `/login` e a faixa some.
4. Fazer um login normal em seguida: a faixa **não** pode reaparecer.

Também não exercitado com sessão real (precisava de um operador `billing`, que não existe):
os 403 de papel em `/api/admin/workspaces` (GET/POST), no dashboard podado e no `DELETE` de conta.
A lógica é a mesma `requirePlatformAbility` que já foi provada ao vivo com sessão `support` e
`billing` de teste nas rotas de workspace.

---

## 4. Dívida registrada, não bloqueia

- **`listUsers({ perPage: 200 })`** em `/api/admin/accounts` é um teto silencioso: passando de 200
  contas, órfãs somem da lista e membros aparecem sem e-mail nem último acesso. Hoje são 5 contas.
- **Nenhuma tela para gerenciar operadores.** Operador novo entra por SQL:
  `insert into public.platform_admins (user_id, email, role, created_by) select id, email, 'support', 'manual' from auth.users where lower(email) = '<email>';`
- **Papel `billing` é quase inerte na UI**: vê só o Dashboard (podado), e para mudar plano
  precisaria do detalhe da conta, que exige `read_customer_data`. Decidir se ganha uma visão
  reduzida ou se o papel some.
- **`trial_ends_at` é lido e nunca escrito** — nenhuma rota aceita o campo, então o card
  "Trials vencendo em 7 dias" nunca popula.
- **As telas do painel não tratam erro de rede**: `fetch` sem `try/catch`, então queda de rede vira
  spinner eterno ou "Conta não encontrada" (que também é o que um 403 mostra).
- **A UI do detalhe não esconde nada por papel** — o servidor devolve 403 corretamente, mas um
  `support` percorre o fluxo de exclusão definitiva inteiro para tomar 403 no último clique.
- **Reativar workspace pelo `PATCH`** grava `workspace.reactivate`; marcar como `deleted` pelo
  `PATCH` grava `workspace.suspend`, enquanto o `DELETE` soft grava `workspace.delete_soft`. Mesma
  mudança de estado por caminhos diferentes; o `metadata.to` deixa a linha legível.
- **A contagem do diálogo de exclusão não revalida** se ficar aberto; a que vai para o log é medida
  no servidor no instante da execução, então o log está sempre certo.
- **Workspace com `slug` null não é apagável** pelo endpoint (falha fechada, sem mensagem
  explicando).
- **O plano ficou internamente inconsistente**: ainda cita `OWNS_ACTIVE_WORKSPACE` (renomeado para
  `OWNS_WORKSPACE`) em passos de verificação. O spec, que é a autoridade, está atualizado.

---

## 5. O que já foi verificado ao vivo (não precisa refazer)

- Papel vindo de `platform_admins`, linha `suspended` cortando acesso, e a env vencendo a linha
  suspensa — os três com sessão real, operador descartável, apagado depois.
- `support` recebe 403 ao mudar plano e 200 ao suspender; `billing` o inverso. No servidor.
- As 6 ações de auditoria gravadas por requisições reais; ação recusada não gera linha; o `POST` de
  workspace desfaz a criação se a auditoria falhar.
- As quatro travas da remoção definitiva: 400 sem digitação, 400 com digitação errada, 403 para
  `support`, 409 para dono de workspace ativo — e a destruição bem-sucedida num workspace
  descartável, com a contagem preservada no log depois de o workspace não existir mais.
- Isolamento de sessão entre os dois hosts, e `/api/*` no host do painel devolvendo 404 em vez de
  pular o corte por membership.
- Grants: 0 linhas para `anon`/`authenticated` nas tabelas novas e nas 3 RPCs.
