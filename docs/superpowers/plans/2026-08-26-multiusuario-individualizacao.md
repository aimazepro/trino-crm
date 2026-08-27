# Individualização multiusuário — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a camada de interface do TrinoCRM refletir a multiusuário que o banco já suporta: cada ação atribuída a quem a fez, cada vendedor vendo o que é dele, gerente e admin vendo tudo.

**Architecture:** Três fases sequenciais sobre uma fundação comum. A Fase 1 fecha o modelo de propriedade no banco (auto-claim de conversa, assinatura por membro, RLS de atividade e ligação) e cria o kit de UI (`useTeam`, `OwnerBadge`, `OwnerSelect`, `ScopeToggle`) que as fases seguintes consomem. A Fase 2 aplica o kit em Negócios, Atividades e Contatos. A Fase 3 entrega os relatórios por papel e o placar agregado.

**Tech Stack:** Next.js 16.2.3 (App Router), React 19.2.4, TypeScript, Supabase (Postgres 17 + RLS), Tailwind v4, Evolution API para WhatsApp.

**Spec:** [`docs/superpowers/specs/2026-08-26-multiusuario-individualizacao-design.md`](../specs/2026-08-26-multiusuario-individualizacao-design.md)

## Global Constraints

- **Não existe framework de teste no repositório.** Não há vitest, jest nem playwright, e nenhum arquivo `*.test.*`. **Não introduza um.** A verificação é: asserção SQL antes/depois de cada migration, `npx tsc --noEmit`, `npm run build` e conferência manual no navegador.
- **Toda migration vai para `supabase/migrations/YYYYMMDDHHMMSS_nome.sql`** e é aplicada com a ferramenta MCP `mcp__supabase__apply_migration` no projeto `etdkzpiehoivrviylemd`. A organização Supabase está no plano gratuito: **branches de banco não estão disponíveis**, as migrations vão direto para produção. Por isso toda migration deste plano é aditiva e reversível.
- **Helpers de RLS que já existem e devem ser reusados:** `my_workspace_ids()`, `is_ws_admin(uuid)`, `is_ws_manager(uuid)`. Não crie helper novo.
- **Papéis:** `admin`, `gerente`, `vendedor` (coluna `workspace_members.role`). `is_ws_manager()` cobre admin e gerente.
- **Idioma da interface:** português do Brasil, sem acentuação quebrada.
- **Ids reais para asserção** (workspace de teste `5e0c7833-819c-4f39-8864-12ab0fb17093`):
  - João Reis, `admin` — `5e0c7833-819c-4f39-8864-12ab0fb17093`
  - Ana Clara, `vendedor` — `0c68aa6d-be0c-468d-9a7d-fed10ace1887`
- **Padrão de asserção de RLS** — roda em transação e desfaz, então é seguro em produção:

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
-- consulta da asserção aqui
rollback;
```

- **Regenerar tipos** depois de cada migration: `npx supabase gen types typescript --project-id etdkzpiehoivrviylemd > src/lib/supabase/database.types.ts`
- **Deploy é manual.** `git push` não publica. Publicar exige `vercel deploy --prod`. Não publique sem o usuário pedir.

---

# FASE 1 — Fundação e WhatsApp

### Task 1: Migration — propriedade de conversa (auto-claim + correção do sync)

Hoje `sync_whatsapp_conversation_links` grava `owner_id` do dono do negócio incondicionalmente e o zera quando o contato perde o último negócio vivo. Isso é incompatível com auto-claim: o vendedor reivindicaria a conversa e ela pularia para outro dono sozinha.

**Files:**
- Create: `supabase/migrations/20260827100000_whatsapp_conversation_ownership.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerado)

**Interfaces:**
- Consumes: nada.
- Produces: trigger `whatsapp_messages_autoclaim_conversation`; função `public.claim_whatsapp_conversation()`; `sync_whatsapp_conversation_links()` com semântica nova (só preenche dono nulo).

- [ ] **Step 1: Escrever a asserção que falha**

Rode com `mcp__supabase__execute_sql` no projeto `etdkzpiehoivrviylemd`:

```sql
-- Asserção A: uma conversa sem dono deve continuar sem dono depois de uma
-- mensagem de automação (sent_by null), e deve ganhar dono depois de uma
-- mensagem de gente.
begin;
insert into whatsapp_conversations (workspace_id, connection_id, remote_jid, phone, owner_id)
select '5e0c7833-819c-4f39-8864-12ab0fb17093', id, '5599999999999@s.whatsapp.net', '5599999999999', null
from whatsapp_connections where workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093' limit 1;

insert into whatsapp_messages (workspace_id, conversation_id, from_me, type, body, status, sent_by, timestamp)
select '5e0c7833-819c-4f39-8864-12ab0fb17093', id, true, 'text', 'robo', 'sent', null, now()
from whatsapp_conversations where phone = '5599999999999';

select 'apos automacao' as etapa, owner_id from whatsapp_conversations where phone = '5599999999999';

insert into whatsapp_messages (workspace_id, conversation_id, from_me, type, body, status, sent_by, timestamp)
select '5e0c7833-819c-4f39-8864-12ab0fb17093', id, true, 'text', 'oi', 'sent', '0c68aa6d-be0c-468d-9a7d-fed10ace1887', now()
from whatsapp_conversations where phone = '5599999999999';

select 'apos vendedor' as etapa, owner_id from whatsapp_conversations where phone = '5599999999999';
rollback;
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado hoje: `apos automacao` → `null` (já correto por acidente, não há trigger) e **`apos vendedor` → `null`** (errado; deveria ser `0c68aa6d-…`). É essa segunda linha que prova a falta do auto-claim.

- [ ] **Step 3: Escrever a migration**

```sql
-- supabase/migrations/20260827100000_whatsapp_conversation_ownership.sql
--
-- Dono de conversa passa a ser de quem atendeu, não do dono do negócio.
--
-- Duas mudanças que só fazem sentido juntas:
--   1. auto-claim: a primeira resposta humana numa conversa órfã a reivindica;
--   2. sync_whatsapp_conversation_links para de sobrescrever esse dono.
-- Sem (2), o (1) seria desfeito no próximo vínculo de negócio ao contato.

-- 1. Auto-claim -------------------------------------------------------------

create or replace function public.claim_whatsapp_conversation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Só mensagem de gente reivindica. A fila de automação envia com sent_by
  -- nulo justamente para que um robô nunca tire um lead da fila.
  if new.from_me is true and new.sent_by is not null then
    update public.whatsapp_conversations
       set owner_id = new.sent_by,
           updated_at = now()
     where id = new.conversation_id
       and owner_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_autoclaim_conversation on public.whatsapp_messages;
create trigger whatsapp_messages_autoclaim_conversation
  after insert on public.whatsapp_messages
  for each row
  execute function public.claim_whatsapp_conversation();

-- 2. sync deixa de ser autoridade sobre o dono -------------------------------

create or replace function public.sync_whatsapp_conversation_links()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH best AS (
    SELECT id, owner_id
    FROM public.deals
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND deleted_at IS NULL
    ORDER BY (status = 'Ativo') DESC, updated_at DESC
    LIMIT 1
  )
  UPDATE public.whatsapp_conversations c
  SET deal_id = best.id,
      -- COALESCE: quem atendeu continua dono. O negócio só preenche o vazio.
      owner_id = COALESCE(c.owner_id, best.owner_id),
      updated_at = now()
  FROM best
  WHERE c.workspace_id = NEW.workspace_id
    AND c.contact_id = NEW.contact_id
    AND (c.deal_id IS DISTINCT FROM best.id
         OR c.owner_id IS DISTINCT FROM COALESCE(c.owner_id, best.owner_id));

  -- Contato sem nenhum negócio vivo: o vínculo com o negócio deixa de valer,
  -- mas o dono NÃO é zerado. Perder o negócio não devolve a conversa para a
  -- fila -- quem vinha atendendo continua atendendo.
  IF NOT EXISTS (
    SELECT 1 FROM public.deals
    WHERE workspace_id = NEW.workspace_id AND contact_id = NEW.contact_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.whatsapp_conversations
    SET deal_id = NULL, updated_at = now()
    WHERE workspace_id = NEW.workspace_id
      AND contact_id = NEW.contact_id
      AND deal_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;
```

- [ ] **Step 4: Aplicar**

`mcp__supabase__apply_migration` com `project_id: etdkzpiehoivrviylemd`, `name: whatsapp_conversation_ownership`, e o SQL acima.

- [ ] **Step 5: Rodar a asserção do Step 1 de novo**

Esperado: `apos automacao` → `null`; `apos vendedor` → `0c68aa6d-be0c-468d-9a7d-fed10ace1887`.

- [ ] **Step 6: Asserção de que o sync não rouba mais o dono**

```sql
begin;
-- conversa reivindicada pela Ana, contato ligado a um negócio do João
insert into whatsapp_conversations (workspace_id, connection_id, remote_jid, phone, owner_id, contact_id)
select '5e0c7833-819c-4f39-8864-12ab0fb17093', wc.id, '5598888888888@s.whatsapp.net', '5598888888888',
       '0c68aa6d-be0c-468d-9a7d-fed10ace1887', d.contact_id
from whatsapp_connections wc, deals d
where wc.workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093'
  and d.workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093'
  and d.contact_id is not null and d.owner_id = '5e0c7833-819c-4f39-8864-12ab0fb17093'
limit 1;

-- dispara o trigger de sync
update deals set updated_at = now()
where workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093'
  and contact_id = (select contact_id from whatsapp_conversations where phone = '5598888888888');

select owner_id from whatsapp_conversations where phone = '5598888888888';
rollback;
```

Esperado: `0c68aa6d-…` (a Ana continua dona). Antes da migration isso viraria o id do João.

- [ ] **Step 7: Regenerar tipos e commitar**

```bash
npx supabase gen types typescript --project-id etdkzpiehoivrviylemd > src/lib/supabase/database.types.ts
npx tsc --noEmit
git add supabase/migrations/20260827100000_whatsapp_conversation_ownership.sql src/lib/supabase/database.types.ts
git commit -m "feat(whatsapp): auto-claim de conversa pelo primeiro atendente

O dono da conversa passa a ser quem respondeu primeiro, não o dono do
negócio. sync_whatsapp_conversation_links deixa de sobrescrever esse
dono (COALESCE) e para de zerá-lo quando o contato perde o último
negócio -- perder o negócio não devolve a conversa para a fila."
```

---

### Task 2: Migration — assinatura por membro, avatar e identidade

**Files:**
- Create: `supabase/migrations/20260827100100_member_identity_and_signature.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerado)

**Interfaces:**
- Consumes: nada.
- Produces: tabela `whatsapp_member_settings(workspace_id uuid, user_id uuid, signature_enabled boolean)`; coluna `workspace_members.avatar_url text`.

- [ ] **Step 1: Escrever a asserção que falha**

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='whatsapp_member_settings') as tem_tabela,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='workspace_members' and column_name='avatar_url') as tem_avatar,
  (select count(*) from auth.users
     where raw_user_meta_data ? 'name' and not (raw_user_meta_data ? 'full_name')) as sem_full_name;
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado hoje: `tem_tabela = 0`, `tem_avatar = 0`, `sem_full_name = 1` (Ana Clara).

- [ ] **Step 3: Escrever a migration**

```sql
-- supabase/migrations/20260827100100_member_identity_and_signature.sql
--
-- Identidade do membro e assinatura por pessoa.
--
-- O avatar mora em auth.users.user_metadata, que o cliente não consegue ler
-- de OUTRO usuário -- por isso o avatar de colega nunca aparecia. Espelhar a
-- URL pública em workspace_members resolve sem rota de servidor: o bucket
-- `avatars` já é público e workspace_members já é legível por qualquer membro
-- do workspace.

alter table public.workspace_members
  add column if not exists avatar_url text;

-- Assinatura por membro. Deliberadamente SEM coluna de nome: a assinatura
-- deriva de workspace_members.name, o que a trava por construção -- não há
-- campo para o vendedor assinar com o nome de outra pessoa.
create table if not exists public.whatsapp_member_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.whatsapp_member_settings enable row level security;

-- Cada um lê a própria linha; gerente e admin leem todas (a tela de WhatsApp
-- do admin mostra quem está assinando).
create policy "whatsapp_member_settings: select"
  on public.whatsapp_member_settings for select
  using (
    workspace_id in (select my_workspace_ids())
    and (user_id = (select auth.uid()) or (select is_ws_manager(workspace_id)))
  );

-- Escrita é sempre da própria linha, inclusive para o admin: o toggle é uma
-- preferência pessoal, não uma configuração que se aplica a terceiros.
create policy "whatsapp_member_settings: insert"
  on public.whatsapp_member_settings for insert
  with check (
    workspace_id in (select my_workspace_ids())
    and user_id = (select auth.uid())
  );

create policy "whatsapp_member_settings: update"
  on public.whatsapp_member_settings for update
  using (
    workspace_id in (select my_workspace_ids())
    and user_id = (select auth.uid())
  );

-- Backfill de identidade -----------------------------------------------------

-- O aceite de convite gravava user_metadata.name; o app inteiro lê full_name.
-- Idempotente: só escreve quando full_name está ausente.
update auth.users
   set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', raw_user_meta_data->>'name')
 where raw_user_meta_data ? 'name'
   and not (raw_user_meta_data ? 'full_name');

-- Espelha nome e avatar do metadata para workspace_members quando faltarem.
update public.workspace_members m
   set name = coalesce(m.name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
       avatar_url = coalesce(m.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
  from auth.users u
 where u.id = m.member_user_id
   and (m.name is null or m.avatar_url is null);

-- Toda pessoa já aceita começa com assinatura ligada.
insert into public.whatsapp_member_settings (workspace_id, user_id)
select workspace_id, member_user_id
  from public.workspace_members
 where member_user_id is not null and status = 'accepted'
on conflict do nothing;
```

- [ ] **Step 4: Aplicar**

`mcp__supabase__apply_migration`, `name: member_identity_and_signature`.

- [ ] **Step 5: Rodar a asserção do Step 1 de novo**

Esperado: `tem_tabela = 1`, `tem_avatar = 1`, `sem_full_name = 0`.

- [ ] **Step 6: Conferir a RLS da tabela nova**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
select count(*) as linhas_visiveis from whatsapp_member_settings;
rollback;
```

Esperado: `1` — a Ana é vendedora, então enxerga só a própria linha.

- [ ] **Step 7: Regenerar tipos e commitar**

```bash
npx supabase gen types typescript --project-id etdkzpiehoivrviylemd > src/lib/supabase/database.types.ts
npx tsc --noEmit
git add supabase/migrations/20260827100100_member_identity_and_signature.sql src/lib/supabase/database.types.ts
git commit -m "feat(workspace): identidade de membro e assinatura por pessoa

workspace_members ganha avatar_url para que o avatar de colega seja
legível (user_metadata não é, entre usuários). whatsapp_member_settings
guarda só o liga/desliga: o nome da assinatura deriva de
workspace_members.name, o que impede assinar como outra pessoa.

Backfill copia user_metadata.name para full_name -- o aceite de convite
gravava a chave errada e o app inteiro lê full_name."
```

---

### Task 3: Migration — RLS de atividade por responsável e de ligação por usuário

`activities.assignee_id` existe, a API v1 o valida e o modal já tem seletor de responsável — mas a RLS só olha `deals.owner_id`, então o responsável designado não lê a própria tarefa se o negócio for de outra pessoa. `telephony_calls` não tem escopo nenhum por usuário.

**Files:**
- Create: `supabase/migrations/20260827100200_activity_assignee_and_call_scope.sql`

**Interfaces:**
- Consumes: nada.
- Produces: políticas `activities: select|update|delete` e `telephony_calls: select` novas.

- [ ] **Step 1: Escrever a asserção que falha**

```sql
begin;
-- Atribui uma atividade de um negócio do João à Ana
update activities set assignee_id = '0c68aa6d-be0c-468d-9a7d-fed10ace1887'
 where id = (select a.id from activities a join deals d on d.id = a.deal_id
              where d.owner_id = '5e0c7833-819c-4f39-8864-12ab0fb17093' limit 1);

select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
select count(*) as atividades_da_ana from activities
 where assignee_id = '0c68aa6d-be0c-468d-9a7d-fed10ace1887';
select count(*) as ligacoes_visiveis from telephony_calls;
rollback;
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado hoje: `atividades_da_ana = 0` (ela é responsável mas não consegue ler) e `ligacoes_visiveis` = o total do workspace (ela vê ligação dos outros).

- [ ] **Step 3: Escrever a migration**

```sql
-- supabase/migrations/20260827100200_activity_assignee_and_call_scope.sql
--
-- Duas lacunas de escopo que a Fase 1 do multi-tenant deixou passar.

-- 1. Atividade: o responsável designado precisa enxergar a própria tarefa,
--    mesmo quando o negócio é de outra pessoa. Sem isso o seletor de
--    responsável (que já existe no modal e na API v1) atribui para o vazio.

drop policy if exists "activities: select" on public.activities;
create policy "activities: select"
  on public.activities for select
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "activities: update" on public.activities;
create policy "activities: update"
  on public.activities for update
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "activities: delete" on public.activities;
create policy "activities: delete"
  on public.activities for delete
  using (
    workspace_id in (select my_workspace_ids())
    and (
      assignee_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
      or exists (
        select 1 from public.deals d
         where d.id = activities.deal_id
           and d.owner_id = (select auth.uid())
      )
    )
  );

-- 2. Ligação: vendedor via as ligações do workspace inteiro.

drop policy if exists "telephony_calls: select" on public.telephony_calls;
create policy "telephony_calls: select"
  on public.telephony_calls for select
  using (
    workspace_id in (select my_workspace_ids())
    and (
      user_id = (select auth.uid())
      or (select is_ws_manager(workspace_id))
    )
  );
```

- [ ] **Step 4: Aplicar**

`mcp__supabase__apply_migration`, `name: activity_assignee_and_call_scope`.

- [ ] **Step 5: Rodar a asserção do Step 1 de novo**

Esperado: `atividades_da_ana = 1`; `ligacoes_visiveis = 0` (nenhuma ligação é dela).

- [ ] **Step 6: Conferir que o gerente continua vendo tudo**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"5e0c7833-819c-4f39-8864-12ab0fb17093","role":"authenticated"}', true);
set local role authenticated;
select count(*) as atividades from activities;
select count(*) as ligacoes from telephony_calls;
rollback;
```

Esperado: os totais do workspace, iguais aos de antes da migration.

- [ ] **Step 7: Commitar**

```bash
git add supabase/migrations/20260827100200_activity_assignee_and_call_scope.sql
git commit -m "fix(rls): atividade enxerga o responsável, ligação enxerga o dono

activities.assignee_id existia e era validado pela API v1, mas a RLS só
olhava deals.owner_id -- atribuir tarefa a outro vendedor a tornava
invisível para ele. telephony_calls não tinha escopo por usuário nenhum."
```

---

### Task 4: Hook `useTeam()`

**Files:**
- Create: `src/hooks/use-team.ts`
- Modify: `src/hooks/use-owner-name-map.ts` (vira alias fino sobre `useTeam`)

**Interfaces:**
- Consumes: `useWorkspace()` de `src/lib/workspace.tsx` (`{ workspaceId, role, userId }`).
- Produces:

```ts
export interface TeamMember {
  id: string;            // member_user_id
  name: string;          // workspace_members.name, ou o email quando nulo
  email: string;
  role: "admin" | "gerente" | "vendedor";
  avatarUrl: string | null;
}
export interface TeamInfo {
  members: TeamMember[];
  map: Record<string, string>;             // id -> nome
  avatars: Record<string, string | null>;  // id -> url
  self: TeamMember | null;
  isManager: boolean;                      // admin ou gerente
  loading: boolean;
}
export function useTeam(): TeamInfo;
export function getInitials(name: string): string;  // re-export
```

- [ ] **Step 1: Escrever o hook**

```ts
// src/hooks/use-team.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceInfo } from "@/lib/workspace";

export type TeamRole = "admin" | "gerente" | "vendedor";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl: string | null;
}

export interface TeamInfo {
  members: TeamMember[];
  map: Record<string, string>;
  avatars: Record<string, string | null>;
  self: TeamMember | null;
  isManager: boolean;
  loading: boolean;
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "V";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Quem está no workspace, para qualquer tela que precise mostrar ou filtrar
 * por pessoa. Substitui useOwnerNameMap, que derivava a lista do próprio
 * usuário logado e por isso escondia todo mundo que ainda não tinha registro
 * atribuído -- um vendedor recém-convidado era invisível no sistema inteiro.
 */
export function useTeam(): TeamInfo {
  const info = useWorkspaceInfo();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("member_user_id, name, email, role, avatar_url")
        .eq("workspace_id", info.workspaceId)
        .eq("status", "accepted");

      if (cancelled) return;

      const list: TeamMember[] = (data ?? [])
        .filter((m) => m.member_user_id)
        .map((m) => ({
          id: m.member_user_id as string,
          name: m.name || m.email,
          email: m.email,
          role: (m.role as TeamRole) ?? "vendedor",
          avatarUrl: m.avatar_url ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      setMembers(list);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [supabase, info]);

  return useMemo(() => {
    const map: Record<string, string> = {};
    const avatars: Record<string, string | null> = {};
    for (const m of members) {
      map[m.id] = m.name;
      avatars[m.id] = m.avatarUrl;
    }
    return {
      members,
      map,
      avatars,
      self: members.find((m) => m.id === info?.userId) ?? null,
      isManager: info?.role === "admin" || info?.role === "gerente",
      loading,
    };
  }, [members, info, loading]);
}
```

- [ ] **Step 2: Reescrever `use-owner-name-map.ts` como alias**

Os oito consumidores atuais (`conversas`, `insights/use-report-result`, `insights/panel-view`, `insights/reports/[id]/report-viewer`, `ligacoes`, `contatos`, `atividades`, `negocios/[id]`, `merge-deal-modal`, `deal-tabs`, `kanban-board`) não podem quebrar de uma vez.

```ts
// src/hooks/use-owner-name-map.ts
"use client";

// Fachada de compatibilidade sobre useTeam. Novas telas devem usar useTeam
// direto -- este arquivo existe só para os consumidores anteriores à
// individualização multiusuário e some quando o último migrar.

import { useTeam, getInitials } from "@/hooks/use-team";

export { getInitials };

export function useOwnerNameMap(): {
  map: Record<string, string>;
  avatars: Record<string, string | null>;
  names: string[];
  selfName: string;
  selfId: string;
} {
  const { map, avatars, members, self } = useTeam();
  return {
    map,
    avatars,
    names: members.map((m) => m.name),
    selfName: self?.name ?? "",
    selfId: self?.id ?? "",
  };
}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erro. Se `avatar_url` não existir no tipo, a Task 2 não foi aplicada ou os tipos não foram regenerados.

- [ ] **Step 4: Verificar no navegador**

`npm run dev`, abrir `/conversas` logado como admin, abrir o dropdown de vendedores. Esperado: **"Joao Reis" e "Ana Clara"** — hoje só aparece "Joao Reis". (O filtro em si ainda usa nome; a Task 7 corrige. Aqui só se confirma que a lista encheu.)

- [ ] **Step 5: Commitar**

```bash
git add src/hooks/use-team.ts src/hooks/use-owner-name-map.ts
git commit -m "feat(team): hook useTeam com o time inteiro do workspace

useOwnerNameMap montava o mapa a partir do usuário logado mais os
membros, mas só carregava o avatar do próprio usuário e não expunha
papel. Vira fachada sobre useTeam, que lê workspace_members com
avatar_url e papel."
```

---

### Task 5: Componentes `OwnerBadge`, `OwnerSelect`, `ScopeToggle`

**Files:**
- Create: `src/components/team/owner-badge.tsx`
- Create: `src/components/team/owner-select.tsx`
- Create: `src/components/team/scope-toggle.tsx`

**Interfaces:**
- Consumes: `useTeam()`, `getInitials()` da Task 4; `cn()` de `src/lib/utils`.
- Produces:

```ts
<OwnerBadge ownerId={string | null} size?: "sm" | "md" showName?: boolean />
<OwnerSelect value={string | null} onChange={(id: string | null) => void}
             allowUnassigned?: boolean disabled?: boolean placeholder?: string />
<ScopeToggle<T extends string> value={T} onChange={(v: T) => void}
             options={{ value: T; label: string; hidden?: boolean }[]} />
```

- [ ] **Step 1: Escrever `OwnerBadge`**

```tsx
// src/components/team/owner-badge.tsx
"use client";

import { cn } from "@/lib/utils";
import { useTeam, getInitials } from "@/hooks/use-team";

interface Props {
  ownerId: string | null | undefined;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}

/**
 * Avatar mais nome de um membro. Um id que não está mais no time (pessoa
 * removida) renderiza "Usuário removido" em vez de string vazia -- registro
 * histórico não deve virar buraco na interface.
 */
export function OwnerBadge({ ownerId, size = "sm", showName = true, className }: Props) {
  const { map, avatars } = useTeam();

  const known = ownerId ? map[ownerId] : undefined;
  const name = ownerId ? (known ?? "Usuário removido") : "Sem dono";
  const avatar = ownerId ? avatars[ownerId] : null;
  const px = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs";

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} title={name}
             className={cn("rounded-full object-cover shrink-0 ring-1 ring-zinc-200", px)} />
      ) : (
        <span title={name}
              className={cn(
                "rounded-full shrink-0 flex items-center justify-center font-extrabold uppercase tracking-tighter ring-1 ring-zinc-200",
                ownerId && known
                  ? "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white"
                  : "bg-zinc-100 text-zinc-400",
                px,
              )}>
          {ownerId && known ? getInitials(name) : "?"}
        </span>
      )}
      {showName && <span className="truncate text-xs text-zinc-600">{name}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Escrever `OwnerSelect`**

```tsx
// src/components/team/owner-select.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";
import { OwnerBadge } from "@/components/team/owner-badge";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  allowUnassigned?: boolean;
  unassignedLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Dropdown de membros ativos do workspace. */
export function OwnerSelect({
  value, onChange, allowUnassigned = false,
  unassignedLabel = "Sem dono", disabled = false, className,
}: Props) {
  const { members, map, loading } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = value ? (map[value] ?? "Usuário removido") : unassignedLabel;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate">{loading ? "Carregando..." : label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {allowUnassigned && (
            <button type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50">
              {unassignedLabel}
              {value === null && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          )}
          {members.length === 0 && !loading && (
            <p className="px-3 py-2 text-xs text-zinc-400">Nenhum membro ativo.</p>
          )}
          {members.map((m) => (
            <button key={m.id} type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-zinc-50",
                value === m.id && "bg-zinc-50 font-semibold",
              )}>
              <OwnerBadge ownerId={m.id} />
              {value === m.id && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Escrever `ScopeToggle`**

```tsx
// src/components/team/scope-toggle.tsx
"use client";

import { cn } from "@/lib/utils";

export interface ScopeOption<T extends string> {
  value: T;
  label: string;
  /** Escopo que o papel do usuário não permite -- não renderiza. */
  hidden?: boolean;
  count?: number;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ScopeOption<T>[];
  className?: string;
}

export function ScopeToggle<T extends string>({ value, onChange, options, className }: Props<T>) {
  const visible = options.filter((o) => !o.hidden);
  if (visible.length < 2) return null;

  return (
    <div className={cn("inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5", className)}>
      {visible.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700",
          )}>
          {o.label}
          {typeof o.count === "number" && o.count > 0 && (
            <span className="ml-1.5 text-[10px] text-zinc-400">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commitar**

```bash
git add src/components/team/
git commit -m "feat(team): componentes OwnerBadge, OwnerSelect e ScopeToggle

Kit compartilhado para as telas que passam a mostrar e filtrar por
pessoa. OwnerBadge renderiza 'Usuário removido' para id que saiu do
time, em vez de deixar buraco na interface."
```

---

### Task 6: Assinatura pelo remetente no caminho de envio

**Files:**
- Modify: `src/lib/whatsapp/types.ts:44-56` (`applySignature`)
- Modify: `src/lib/whatsapp/send.ts:202-203`
- Create: `src/lib/whatsapp/sender-identity.ts`

**Interfaces:**
- Consumes: tabela `whatsapp_member_settings` e `workspace_members.name` (Task 2).
- Produces:

```ts
// src/lib/whatsapp/sender-identity.ts
export interface SenderSignature { enabled: boolean; name: string | null; }
export async function loadSenderSignature(
  admin: SupabaseClient<Database>, workspaceId: string, sentBy: string | null,
): Promise<SenderSignature | null>;
// types.ts
export function applySignature(
  text: string,
  connection: Pick<WhatsAppConnection, "signatureEnabled" | "signatureName" | "profileName">,
  sender?: SenderSignature | null,
): string;
```

- [ ] **Step 1: Escrever `sender-identity.ts`**

```ts
// src/lib/whatsapp/sender-identity.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SenderSignature {
  enabled: boolean;
  name: string | null;
}

/**
 * Como a mensagem de UMA pessoa deve ser assinada. Devolve null quando não há
 * pessoa (fila de automação), e aí o chamador cai no nome da conexão.
 *
 * O nome vem de workspace_members, nunca de um campo próprio da tabela de
 * preferências: é isso que impede um vendedor assinar como outra pessoa.
 */
export async function loadSenderSignature(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  sentBy: string | null,
): Promise<SenderSignature | null> {
  if (!sentBy) return null;

  const { data: member } = await admin
    .from("workspace_members")
    .select("name, email")
    .eq("workspace_id", workspaceId)
    .eq("member_user_id", sentBy)
    .maybeSingle();

  if (!member) return null;

  const { data: settings } = await admin
    .from("whatsapp_member_settings")
    .select("signature_enabled")
    .eq("workspace_id", workspaceId)
    .eq("user_id", sentBy)
    .maybeSingle();

  // Sem linha de preferência (membro entrou depois do backfill): ligada, que é
  // o default da coluna.
  const enabled = settings?.signature_enabled ?? true;

  // Convite aceito sem nome: usa a parte local do email. Feio, mas assinar com
  // o nome de outra pessoa seria pior.
  const name = member.name?.trim() || member.email?.split("@")[0] || null;

  return { enabled, name };
}
```

- [ ] **Step 2: Trocar `applySignature` em `types.ts`**

Substituir a função inteira (linhas 44-56):

```ts
/**
 * Prefixes the sender's name the way Chatwoot and the Evolution panel do, so a
 * workspace sharing one number still reads as people rather than a switchboard.
 *
 * Quando `sender` vem preenchido, ele MANDA: é a pessoa que clicou em enviar, e
 * assinar a mensagem dela com o nome da conexão diria ao contato que quem
 * escreveu foi outra pessoa. A conexão só assina o que não tem gente atrás
 * (fila de automação, sequências).
 */
export function applySignature(
  text: string,
  connection: Pick<WhatsAppConnection, "signatureEnabled" | "signatureName" | "profileName">,
  sender?: { enabled: boolean; name: string | null } | null,
): string {
  if (sender) {
    if (!sender.enabled || !sender.name) return text;
    return `*${sender.name}*:\n${text}`;
  }
  if (!connection.signatureEnabled) return text;
  const name = (connection.signatureName ?? connection.profileName ?? "").trim();
  if (!name) return text;
  return `*${name}*:\n${text}`;
}
```

- [ ] **Step 3: Ligar no `send.ts`**

Adicionar o import no topo de `src/lib/whatsapp/send.ts`:

```ts
import { loadSenderSignature } from "@/lib/whatsapp/sender-identity";
```

Substituir as linhas 202-203:

```ts
  const sender = await loadSenderSignature(admin, connection.userId, input.sentBy);
  if (text) text = applySignature(text, connection, sender);
  if (media?.caption) media.caption = applySignature(media.caption, connection, sender);
```

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Verificar de ponta a ponta**

Com `npm run dev`, logado como admin, enviar uma mensagem em `/conversas`. Depois:

```sql
select body, sent_by from whatsapp_messages
 where workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093'
 order by timestamp desc limit 1;
```

Esperado: `body` começa com `*Joao Reis*:` (se a assinatura estiver ligada) e `sent_by` é o id do João. Repetir logado como Ana Clara e esperar `*Ana Clara*:`.

- [ ] **Step 6: Commitar**

```bash
git add src/lib/whatsapp/sender-identity.ts src/lib/whatsapp/types.ts src/lib/whatsapp/send.ts
git commit -m "fix(whatsapp): assinar com o nome de quem enviou

applySignature usava o nome da conexão, um valor único do workspace --
mensagem de qualquer vendedor chegava ao contato assinada com o nome do
admin. O nome vem de workspace_members, não de campo editável, então
não há como assinar como outra pessoa. A conexão segue assinando o que
não tem gente atrás (fila de automação)."
```

---

### Task 7: Conversas — escopos e filtro por id

**Files:**
- Modify: `src/app/conversas/page.tsx:19,44,118-137,186-220`

**Interfaces:**
- Consumes: `useTeam()` (Task 4), `ScopeToggle`, `OwnerSelect` (Task 5).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Trocar os imports e o estado de escopo**

Em `src/app/conversas/page.tsx`, trocar o import de `useOwnerNameMap` por:

```tsx
import { useTeam } from "@/hooks/use-team";
import { ScopeToggle } from "@/components/team/scope-toggle";
import { OwnerSelect } from "@/components/team/owner-select";
import { OwnerBadge } from "@/components/team/owner-badge";
```

Trocar a linha 19 e o estado:

```tsx
type Scope = "minhas" | "fila" | "time";

// ...dentro do componente, no lugar das linhas 37 e 44-45:
const { map: ownerNames, self, isManager, members } = useTeam();
const selfId = self?.id ?? "";
const selfName = self?.name ?? "";
const [scope, setScope] = useState<Scope>("minhas");
const [vendorFilter, setVendorFilter] = useState<string | null>(null); // id, não nome
```

- [ ] **Step 2: Trocar `teamNames` por contagens de escopo**

Substituir o `useMemo` de `teamNames` (linhas 118-122):

```tsx
  // Contadores dos escopos, calculados antes do filtro de escopo para que a
  // aba mostre quantas conversas ela tem mesmo sem estar selecionada.
  const scopeCounts = useMemo(() => ({
    minhas: enriched.filter(c => c.ownerId === selfId).length,
    fila: enriched.filter(c => !c.ownerId).length,
    time: enriched.length,
  }), [enriched, selfId]);
```

- [ ] **Step 3: Trocar a cadeia de filtros**

Substituir as linhas 134-137 (os dois primeiros `.filter`):

```tsx
  const visible = enriched
    // "Minhas" é só o que é meu. A fila tem aba própria agora -- misturar
    // conversa sem dono em "Minhas" fazia o vendedor achar que já era dele.
    .filter(c => {
      if (scope === "minhas") return c.ownerId === selfId;
      if (scope === "fila") return !c.ownerId;
      return true; // time
    })
    .filter(c => (scope === "time" && vendorFilter ? c.ownerId === vendorFilter : true))
```

- [ ] **Step 4: Trocar o cabeçalho de filtros**

Substituir o bloco do dropdown de vendedores (linhas ~186-220) por:

```tsx
          <ScopeToggle<Scope>
            value={scope}
            onChange={(v) => { setScope(v); setVendorFilter(null); }}
            options={[
              { value: "minhas", label: "Minhas", count: scopeCounts.minhas },
              { value: "fila", label: "Fila", count: scopeCounts.fila },
              { value: "time", label: "Time", count: scopeCounts.time, hidden: !isManager },
            ]}
          />

          {scope === "time" && (
            <OwnerSelect
              value={vendorFilter}
              onChange={setVendorFilter}
              allowUnassigned
              unassignedLabel="Todos os vendedores"
              className="w-48"
            />
          )}
```

- [ ] **Step 5: Corrigir a mensagem de estado vazio**

Substituir as linhas ~296-297:

```tsx
                {scope === "fila"
                  ? "Nenhuma conversa esperando atendimento."
                  : scope === "time" && vendorFilter
                    ? `Sem conversas de ${ownerNames[vendorFilter] ?? "esse vendedor"} com esse filtro.`
```

- [ ] **Step 6: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Depois, com `npm run dev`, logado como **admin**: as três abas aparecem; "Time" mostra o `OwnerSelect` com **Joao Reis e Ana Clara**, mesmo que a Ana não tenha conversa alguma. Logado como **vendedor**: só "Minhas" e "Fila".

- [ ] **Step 7: Commitar**

```bash
git add src/app/conversas/page.tsx
git commit -m "fix(conversas): lista de vendedores vem do time, não das conversas

teamNames era montado a partir do ownerName das conversas carregadas.
Com 3 das 4 conversas sem dono, o filtro listava um nome só e vendedor
sem conversa atribuída era invisível. A comparação também passa a ser
por id -- comparar por nome quebra com homônimo e com nome vazio.

A fila ganha aba própria: conversa sem dono estava misturada em
'Minhas', o que fazia o vendedor achar que já era dele."
```

---

### Task 8: Conversas — autoria no balão

**Files:**
- Modify: `src/hooks/use-whatsapp-thread.ts:11-53`
- Modify: `src/components/whatsapp/whatsapp-thread.tsx` (renderização do balão)

**Interfaces:**
- Consumes: `OwnerBadge` (Task 5), `useTeam()` (Task 4).
- Produces: `ThreadMessage.sentBy: string | null`.

- [ ] **Step 1: Expor `sentBy` no tipo e no mapper**

Em `src/hooks/use-whatsapp-thread.ts`, adicionar ao `interface ThreadMessage`, depois de `fromMe`:

```ts
  /** Quem clicou em enviar. Nulo em mensagem recebida e em envio de automação. */
  sentBy: string | null;
```

E no `toMessage()`, depois de `fromMe: row.from_me,`:

```ts
    sentBy: row.sent_by ?? null,
```

- [ ] **Step 2: Confirmar que o realtime também traz o campo**

O canal realtime usa `payload.new` cru e passa pelo mesmo `toMessage`, então `sent_by` chega junto. Nada a mudar — confirme lendo `src/hooks/use-whatsapp-thread.ts:205`.

- [ ] **Step 3: Renderizar o autor no balão**

Em `src/components/whatsapp/whatsapp-thread.tsx`, importar:

```tsx
import { useTeam } from "@/hooks/use-team";
```

e dentro do componente que renderiza a lista, obter `const { map: teamNames } = useTeam();`.

No JSX de cada balão com `message.fromMe`, acima do corpo do texto:

```tsx
{message.fromMe && (
  <span className="mb-0.5 block text-[10px] font-semibold text-green-800/70">
    {message.sentBy ? (teamNames[message.sentBy] ?? "Usuário removido") : "Automação"}
  </span>
)}
```

- [ ] **Step 4: Verificar compilação e navegador**

```bash
npx tsc --noEmit
```

Abrir uma conversa que já tenha mensagens dos dois usuários. No banco há uma mensagem com `sent_by = 0c68aa6d-…` (Ana Clara) e 33 com o id do João. Esperado: os balões mostram nomes diferentes; as 13 mensagens antigas com `sent_by` nulo mostram "Automação".

- [ ] **Step 5: Commitar**

```bash
git add src/hooks/use-whatsapp-thread.ts src/components/whatsapp/whatsapp-thread.tsx
git commit -m "fix(conversas): mostrar quem enviou cada mensagem

sent_by já era gravado corretamente, mas toMessage() descartava o campo
-- o select traz e o mapper jogava fora. Todo balão from_me renderizava
igual, então mensagem de qualquer vendedor parecia do admin."
```

---

### Task 9: Conversas — assumir e reatribuir

**Files:**
- Modify: `src/app/conversas/page.tsx` (cabeçalho da conversa selecionada, ~linha 430)

**Interfaces:**
- Consumes: `OwnerSelect`, `OwnerBadge` (Task 5), `useTeam()` (Task 4).
- Produces: nada.

- [ ] **Step 1: Escrever o handler de atribuição**

Dentro de `ConversasPage`, junto de `handleCreateDeal`:

```tsx
  const [assigning, setAssigning] = useState(false);

  /**
   * Reatribuição explícita. A política de UPDATE de whatsapp_conversations já
   * aceita dono atual, gerente/admin, ou conversa sem dono -- então o vendedor
   * consegue assumir da fila e o gerente consegue passar para outro, sem regra
   * extra aqui.
   */
  async function handleAssign(conversationId: string, ownerId: string | null) {
    if (assigning) return;
    setAssigning(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ owner_id: ownerId })
        .eq("id", conversationId);
      if (error) {
        console.error("[Conversas] atribuir conversa falhou:", error);
        alert("Não foi possível atribuir a conversa.");
      }
    } finally {
      setAssigning(false);
    }
  }
```

- [ ] **Step 2: Renderizar os controles no cabeçalho**

No cabeçalho da conversa selecionada, antes do bloco `{selected.dealId ? ... }`:

```tsx
{!selected.ownerId ? (
  <button
    onClick={() => void handleAssign(selected.id, selfId)}
    disabled={assigning}
    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
  >
    <User className="h-3.5 w-3.5" aria-hidden="true" /> Assumir conversa
  </button>
) : isManager ? (
  <OwnerSelect
    value={selected.ownerId}
    onChange={(id) => void handleAssign(selected.id, id)}
    allowUnassigned
    unassignedLabel="Devolver para a fila"
    disabled={assigning}
    className="w-44 shrink-0"
  />
) : (
  <OwnerBadge ownerId={selected.ownerId} className="shrink-0" />
)}
```

- [ ] **Step 3: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Na aba "Fila", abrir uma conversa e clicar em "Assumir conversa". Esperado: ela sai da fila e aparece em "Minhas" (o Realtime do inbox atualiza a lista). Como admin, numa conversa com dono, o `OwnerSelect` aparece e troca o dono.

- [ ] **Step 4: Commitar**

```bash
git add src/app/conversas/page.tsx
git commit -m "feat(conversas): assumir da fila e reatribuir conversa

Conversa sem dono ganha botão de assumir; gerente e admin trocam o dono
por um seletor. A RLS de UPDATE já permitia os dois casos -- só faltava
o controle na interface."
```

---

### Task 10: Tela de WhatsApp — modo vendedor e assinatura própria

**Files:**
- Create: `src/app/api/whatsapp/my-signature/route.ts`
- Modify: `src/app/configuracoes/whatsapp/page.tsx`
- Modify: `src/app/api/whatsapp/status/route.ts` (expor `mySignatureEnabled`)

**Interfaces:**
- Consumes: `whatsapp_member_settings` (Task 2), `useWorkspace()`.
- Produces: `PATCH /api/whatsapp/my-signature` recebendo `{ enabled: boolean }`, devolvendo `{ enabled: boolean, name: string | null }`.

A rota `/api/whatsapp/settings` **não muda**: ela continua exigindo o dono da conta e é isso que protege QR, desconexão e grupos. A preferência pessoal ganha rota própria justamente para não abrir aquela.

- [ ] **Step 1: Escrever a rota da assinatura própria**

```ts
// src/app/api/whatsapp/my-signature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/**
 * Liga/desliga a assinatura do PRÓPRIO usuário. Rota separada de
 * /api/whatsapp/settings de propósito: aquela é do dono da conta e controla QR,
 * desconexão e grupos. Esta é preferência pessoal e todo membro pode usar.
 *
 * Não existe parâmetro de nome: a assinatura deriva de workspace_members.name.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getWorkspaceContext(supabase);
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("whatsapp_member_settings")
    .upsert(
      { workspace_id: ctx.workspaceId, user_id: ctx.userId, signature_enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,user_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("name, email")
    .eq("workspace_id", ctx.workspaceId)
    .eq("member_user_id", ctx.userId)
    .maybeSingle();

  return NextResponse.json({
    enabled: body.enabled,
    name: member?.name?.trim() || member?.email?.split("@")[0] || null,
  });
}
```

> Se `src/lib/supabase/server.ts` não exportar `createClient`, use o mesmo import que outra rota autenticada do repositório usa (procure por `getWorkspaceContext(` em `src/app/api/convites/route.ts`) e siga aquele padrão.

- [ ] **Step 2: Expor a preferência no `status`**

Em `src/app/api/whatsapp/status/route.ts`, no objeto de resposta, acrescentar a preferência do usuário da requisição e o nome dele. Reuse o `getWorkspaceContext` já disponível na rota; se ela usar apenas o admin client, carregue por `user.id`:

```ts
      mySignatureEnabled: mySettings?.signature_enabled ?? true,
      mySignatureName: myMember?.name?.trim() || myMember?.email?.split("@")[0] || null,
```

- [ ] **Step 3: Dividir a página de WhatsApp por papel**

Em `src/app/configuracoes/whatsapp/page.tsx`, no topo do componente:

```tsx
import { useWorkspace } from "@/lib/workspace";
// ...
const { role } = useWorkspace();
const canManage = role === "admin";
```

`canManage` já é usado na página; confirme que ele passa a derivar do papel e não de outra coisa.

Envolver **todos** os cartões de conexão (QR, status detalhado, botão desconectar, campo de nome da assinatura, cartão de grupos) em `{canManage && ( ... )}`.

Adicionar, visível para todos, o cartão de assinatura pessoal:

```tsx
<div className="rounded-xl border border-zinc-200 bg-white p-5">
  <h2 className="text-sm font-bold text-zinc-900">Sua assinatura</h2>
  <p className="mt-1 text-xs text-zinc-500">
    Prefixa seu nome nas mensagens que você enviar, para o contato saber com quem está falando.
    O nome vem do seu perfil e não pode ser alterado aqui.
  </p>

  <div className="mt-3 rounded-lg bg-zinc-50 p-3">
    <p className="text-xs text-zinc-400">Prévia</p>
    <pre className="mt-1 whitespace-pre-wrap text-xs text-zinc-700">
      {mySignatureEnabled && mySignatureName
        ? `*${mySignatureName}*:\nOlá! Tudo bem?`
        : "Olá! Tudo bem?"}
    </pre>
  </div>

  <button
    type="button"
    role="switch"
    aria-checked={mySignatureEnabled}
    disabled={mySignatureSaving}
    onClick={() => void saveMySignature(!mySignatureEnabled)}
    className={cn(
      "mt-3 relative h-6 w-11 rounded-full transition-colors disabled:opacity-50",
      mySignatureEnabled ? "bg-green-600" : "bg-zinc-300",
    )}
  >
    <span className={cn(
      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
      mySignatureEnabled ? "left-[22px]" : "left-0.5",
    )} />
  </button>
  <span className="ml-2 align-middle text-xs font-medium text-zinc-600">
    {mySignatureEnabled ? "Assinatura ativada" : "Assinatura desativada"}
  </span>
</div>
```

E o handler:

```tsx
const [mySignatureEnabled, setMySignatureEnabled] = useState(true);
const [mySignatureName, setMySignatureName] = useState<string | null>(null);
const [mySignatureSaving, setMySignatureSaving] = useState(false);

async function saveMySignature(next: boolean) {
  setMySignatureSaving(true);
  try {
    const res = await fetch("/api/whatsapp/my-signature", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error ?? "Erro ao salvar assinatura"); return; }
    setMySignatureEnabled(data.enabled);
    setMySignatureName(data.name);
  } finally {
    setMySignatureSaving(false);
  }
}
```

No carregamento inicial (onde a página já lê `/api/whatsapp/status`), popular `mySignatureEnabled` e `mySignatureName` a partir de `data.mySignatureEnabled` e `data.mySignatureName`.

Para o não-admin, o único cartão de conexão é um resumo somente leitura:

```tsx
{!canManage && (
  <div className="rounded-xl border border-zinc-200 bg-white p-5">
    <h2 className="text-sm font-bold text-zinc-900">WhatsApp da empresa</h2>
    <div className="mt-2 flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", status === "open" ? "bg-green-500" : "bg-zinc-300")} />
      <span className="text-xs font-medium text-zinc-600">
        {status === "open" ? `Conectado · ${phoneNumber ?? "número indisponível"}` : "Desconectado"}
      </span>
    </div>
    <p className="mt-2 text-xs text-zinc-400">
      A conexão é gerenciada pelo administrador da conta.
    </p>
  </div>
)}
```

- [ ] **Step 4: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Logado como **admin**: página completa mais o cartão "Sua assinatura". Logado como **vendedor**: só o resumo somente leitura mais "Sua assinatura" — **sem QR, sem desconectar, sem campo de nome, sem cartão de grupos**.

- [ ] **Step 5: Verificar que a rota antiga continua fechada**

Como vendedor, no console do navegador:

```js
await fetch("/api/whatsapp/settings", { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ signatureName: "Hackeado" }) }).then(r => r.status)
```

Esperado: `403`.

- [ ] **Step 6: Commitar**

```bash
git add src/app/api/whatsapp/my-signature/route.ts src/app/api/whatsapp/status/route.ts src/app/configuracoes/whatsapp/page.tsx
git commit -m "feat(whatsapp): assinatura pessoal e tela somente leitura para vendedor

Vendedor passa a ver o status da conexão e a controlar a própria
assinatura, sem acesso a QR, desconexão, nome da assinatura ou grupos.
A preferência ganha rota própria em vez de afrouxar
/api/whatsapp/settings, que segue restrita ao dono da conta."
```

---

# FASE 2 — Negócios, Atividades, Contatos

### Task 11: Migration — dono informativo em contatos e empresas

**Files:**
- Create: `supabase/migrations/20260827100300_contact_company_owner.sql`

**Interfaces:**
- Produces: `contacts.owner_id uuid null`, `companies.owner_id uuid null`.

- [ ] **Step 1: Escrever a asserção que falha**

```sql
select count(*) as tem_owner from information_schema.columns
 where table_schema='public' and column_name='owner_id'
   and table_name in ('contacts','companies');
```

- [ ] **Step 2: Rodar e confirmar que falha** — esperado `0`.

- [ ] **Step 3: Escrever a migration**

```sql
-- supabase/migrations/20260827100300_contact_company_owner.sql
--
-- Dono informativo. A visibilidade NÃO muda: contatos e empresas continuam
-- compartilhados no workspace, porque a base de contatos é patrimônio da
-- empresa e esconder contato de vendedor gera cadastro duplicado.
-- A coluna existe para mostrar de quem é e para permitir filtrar.

alter table public.contacts   add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.companies  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists contacts_owner_id_idx  on public.contacts(owner_id);
create index if not exists companies_owner_id_idx on public.companies(owner_id);

-- Backfill: contato herda do negócio vivo mais recente que aponta para ele.
update public.contacts c
   set owner_id = d.owner_id
  from (
    select distinct on (contact_id) contact_id, owner_id
      from public.deals
     where contact_id is not null and deleted_at is null
     order by contact_id, updated_at desc
  ) d
 where d.contact_id = c.id and c.owner_id is null;

-- Empresa herda do contato mais recente ligado a ela.
update public.companies co
   set owner_id = c.owner_id
  from (
    select distinct on (company_id) company_id, owner_id
      from public.contacts
     where company_id is not null and owner_id is not null
     order by company_id, created_at desc
  ) c
 where c.company_id = co.id and co.owner_id is null;
```

- [ ] **Step 4: Aplicar** — `mcp__supabase__apply_migration`, `name: contact_company_owner`.

- [ ] **Step 5: Conferir o backfill**

```sql
select count(*) filter (where owner_id is not null) as com_dono, count(*) as total from contacts;
```

Esperado: `com_dono` maior que zero (há 15 negócios, todos com dono).

- [ ] **Step 6: Verificar que a visibilidade não mudou**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
select count(*) from contacts;
rollback;
```

Esperado: o total do workspace — a Ana continua vendo todos os contatos.

- [ ] **Step 7: Regenerar tipos e commitar**

```bash
npx supabase gen types typescript --project-id etdkzpiehoivrviylemd > src/lib/supabase/database.types.ts
npx tsc --noEmit
git add supabase/migrations/20260827100300_contact_company_owner.sql src/lib/supabase/database.types.ts
git commit -m "feat(contatos): owner_id informativo em contatos e empresas

A coluna existe para exibir e filtrar. A RLS de leitura não muda: base
de contatos compartilhada evita que dois vendedores cadastrem o mesmo
contato por não enxergarem o do outro."
```

---

### Task 12: Detalhe do negócio — trocar o dono

**Files:**
- Modify: `src/app/negocios/[id]/page.tsx:239-240`
- Modify: `src/hooks/use-crm-mutations.ts` (garantir que `updateDeal` aceite `ownerId`)

**Interfaces:**
- Consumes: `OwnerSelect` (Task 5), `useTeam()` (Task 4), `useCrm()`.

- [ ] **Step 1: Confirmar que `updateDeal` propaga `ownerId`**

Ler `src/hooks/use-crm-mutations.ts` e localizar o mapeamento de campos de `updateDeal`. Se `ownerId` não estiver mapeado para `owner_id`, acrescentar ao objeto de patch:

```ts
    if (patch.ownerId !== undefined) row.owner_id = patch.ownerId;
```

seguindo exatamente o padrão dos campos vizinhos naquele arquivo.

- [ ] **Step 2: Trocar o texto estático pelo seletor**

Substituir as linhas 239-240 de `src/app/negocios/[id]/page.tsx`:

```tsx
<div className="min-w-0">
  <OwnerSelect
    value={deal.ownerId ?? null}
    onChange={(id) => { if (id) void updateDeal(deal.id, { ownerId: id }); }}
    disabled={!canReassign}
    className="w-44"
  />
  <p className="mt-0.5 text-xs text-zinc-400">Proprietário</p>
</div>
```

com, no topo do componente:

```tsx
const { isManager, self } = useTeam();
// Dono pode passar adiante; gerente e admin podem reatribuir qualquer negócio.
// A RLS de UPDATE de deals já impõe exatamente isso -- aqui é só não oferecer
// um controle que o banco vai recusar.
const canReassign = isManager || deal.ownerId === self?.id;
```

- [ ] **Step 3: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Como admin, abrir um negócio e trocar o dono para Ana Clara. Recarregar e confirmar que persistiu. Depois:

```sql
select id, title, owner_id from deals where workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093' order by updated_at desc limit 1;
```

- [ ] **Step 4: Verificar que o negócio some para quem não é mais dono**

Logado como admin, o negócio reatribuído continua visível (gerente vê tudo). Como vendedor, um negócio que **não** é dele não aparece no kanban.

- [ ] **Step 5: Commitar**

```bash
git add src/app/negocios/\[id\]/page.tsx src/hooks/use-crm-mutations.ts
git commit -m "feat(negocios): reatribuir o dono pela tela de detalhe

owner_id era gravado na criação e nunca mais -- só a automação
assign_owner e a API v1 conseguiam reatribuir. O seletor é liberado
para o dono atual e para gerente/admin, o mesmo que a RLS de UPDATE
já permite."
```

---

### Task 13: Negócios — filtro por vendedor

**Files:**
- Modify: `src/app/negocios/page.tsx`
- Modify: `src/components/kanban/kanban-board.tsx`
- Modify: `src/components/kanban/kanban-list-view.tsx`

**Interfaces:**
- Consumes: `OwnerSelect`, `useTeam()`.
- Produces: prop `ownerFilter?: string | null` em `KanbanBoard` e `KanbanListView`.

- [ ] **Step 1: Adicionar o estado e o controle na página**

Em `src/app/negocios/page.tsx`, junto de `statusFilter`:

```tsx
const { isManager } = useTeam();
const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
```

E no cabeçalho, ao lado do filtro de status:

```tsx
{/* Vendedor só enxerga os próprios negócios pela RLS, então o filtro só faz
    sentido para quem vê mais de uma carteira. */}
{isManager && (
  <OwnerSelect
    value={ownerFilter}
    onChange={setOwnerFilter}
    allowUnassigned
    unassignedLabel="Todos os vendedores"
    className="w-44"
  />
)}
```

Passar adiante:

```tsx
<KanbanBoard pipelineId={activePipelineId} onNewDeal={openNewDealModal} statusFilter={statusFilter} ownerFilter={ownerFilter} />
// e
<KanbanListView pipelineId={activePipelineId} statusFilter={statusFilter} columns={visibleColumns} ownerFilter={ownerFilter} />
```

- [ ] **Step 2: Aplicar o filtro nos dois componentes**

Em `kanban-board.tsx` e `kanban-list-view.tsx`, adicionar `ownerFilter?: string | null` às props e incluir na cadeia de filtros existente, ao lado do filtro de status:

```tsx
.filter(d => (ownerFilter ? d.ownerId === ownerFilter : true))
```

- [ ] **Step 3: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Como admin: o seletor aparece; escolher Ana Clara mostra só os negócios dela. Como vendedor: o seletor não renderiza.

- [ ] **Step 4: Commitar**

```bash
git add src/app/negocios/page.tsx src/components/kanban/kanban-board.tsx src/components/kanban/kanban-list-view.tsx
git commit -m "feat(negocios): filtrar o pipeline por vendedor

Kanban e lista só filtravam por status. Renderizado apenas para
gerente/admin: vendedor já enxerga só a carteira dele pela RLS."
```

---

### Task 14: Atividades — filtro real e responsável honesto

**Files:**
- Modify: `src/app/atividades/page.tsx:61-66,90-112,252-263,363`

**Interfaces:**
- Consumes: `useTeam()`, `OwnerBadge`, `OwnerSelect`.

- [ ] **Step 1: Trocar o hook e o estado**

```tsx
import { useTeam } from "@/hooks/use-team";
import { OwnerBadge } from "@/components/team/owner-badge";
import { OwnerSelect } from "@/components/team/owner-select";
// ...
const { self, isManager } = useTeam();
const selfName = self?.name ?? "";
const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
```

Remover o estado `userFilter` (linha 66) inteiro.

- [ ] **Step 2: Fazer o filtro filtrar**

No `useMemo` de `filtered` (linha 90), adicionar como primeira condição do `.filter`:

```tsx
      if (assigneeFilter && a.assigneeId !== assigneeFilter) return false;
```

Aplicar a mesma linha nos outros dois lugares que repetem a cadeia de filtros (linha ~136 e linha ~441), para que a visão de dia e a de calendário concordem com a lista.

- [ ] **Step 3: Trocar o `<select>` decorativo pelo seletor real**

Substituir o bloco inteiro das linhas 252-263:

```tsx
{isManager && (
  <OwnerSelect
    value={assigneeFilter}
    onChange={setAssigneeFilter}
    allowUnassigned
    unassignedLabel="Todos os usuários"
    className="w-44"
  />
)}
```

- [ ] **Step 4: Mostrar o responsável real na linha**

Substituir a linha 363:

```tsx
<OwnerBadge ownerId={a.assigneeId ?? null} />
```

- [ ] **Step 5: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Como admin, criar uma atividade atribuída à Ana Clara e confirmar que a linha mostra **"Ana Clara"**, não seu nome. Filtrar por ela e confirmar que a lista encolhe. Depois logar como Ana e confirmar que ela **vê** essa atividade (é o que a Task 3 destravou).

- [ ] **Step 6: Commitar**

```bash
git add src/app/atividades/page.tsx
git commit -m "fix(atividades): filtro por responsável funciona e a linha diz a verdade

userFilter estava declarado e ligado ao select, mas não participava de
nenhum filtro -- as duas opções fixas não faziam nada. Cada linha
mostrava '{selfName} (você)' fixo, então tarefa de outro vendedor
aparecia como sua."
```

---

### Task 15: Contatos — proprietário real

**Files:**
- Modify: `src/app/contatos/page.tsx:198,345,502,596`
- Modify: `src/lib/crm-transforms.ts` (mapear `owner_id` de contato)
- Modify: `src/lib/crm-types.ts` (campo `ownerId` em `Contact`)

**Interfaces:**
- Consumes: `contacts.owner_id` (Task 11), `OwnerBadge`, `OwnerSelect`, `useTeam()`.

- [ ] **Step 1: Levar `ownerId` até o tipo do cliente**

Em `src/lib/crm-types.ts`, acrescentar à interface `Contact`:

```ts
  ownerId?: string | null;
```

Em `src/lib/crm-transforms.ts`, no mapeamento de linha de contato, acrescentar `ownerId: row.owner_id ?? null,` junto dos campos vizinhos. Faça o mesmo no caminho de escrita, mapeando `owner_id: contact.ownerId ?? null`.

- [ ] **Step 2: Trocar a coluna que mente**

Substituir a linha 345:

```tsx
      case "owner": return c.ownerId ? (ownerNameMap[c.ownerId] ?? "Usuário removido") : "";
```

e a linha 502:

```tsx
{colId === "owner" && <OwnerBadge ownerId={c.ownerId ?? null} />}
```

com `const { map: ownerNameMap, isManager } = useTeam();` no topo (substituindo `useOwnerNameMap` na linha 198).

- [ ] **Step 3: Fazer o filtro por dono usar id**

Na linha 596, o filtro monta `options={["Selecione...", ...ownerNames]}` — nomes. Trocar por `OwnerSelect`, seguindo o padrão da Task 13, e comparar por `c.ownerId`.

- [ ] **Step 4: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Abrir `/contatos` com a coluna Proprietário visível. Esperado: contatos herdados de negócios do João mostram "Joao Reis"; os sem dono ficam em branco — não mais o seu nome em todas as linhas.

- [ ] **Step 5: Commitar**

```bash
git add src/app/contatos/page.tsx src/lib/crm-transforms.ts src/lib/crm-types.ts
git commit -m "fix(contatos): coluna Proprietário lê o dono real

A coluna devolvia currentUserName em toda linha, então todo contato
parecia seu. Passa a ler contacts.owner_id e o filtro compara por id."
```

---

# FASE 3 — Relatórios, ranking, identidade

### Task 16: RPC `team_scoreboard`

**Files:**
- Create: `supabase/migrations/20260827100400_team_scoreboard.sql`

**Interfaces:**
- Produces:

```sql
team_scoreboard(period_start date, period_end date)
  returns table (
    user_id uuid, name text, avatar_url text, role text,
    deals_won bigint, value_won numeric, deals_open bigint,
    activities_done bigint, calls_made bigint
  )
```

- [ ] **Step 1: Escrever a asserção que falha**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
select * from team_scoreboard('2026-01-01'::date, '2026-12-31'::date);
rollback;
```

- [ ] **Step 2: Rodar e confirmar que falha** — esperado: erro `function team_scoreboard(date, date) does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- supabase/migrations/20260827100400_team_scoreboard.sql
--
-- Placar agregado do time.
--
-- Esta é a ÚNICA superfície que fura a RLS de propósito. Ela existe porque o
-- vendedor deve ver o próprio detalhe mais o comparativo do time, e a RLS de
-- deals impede que ele leia negócio alheio -- um relatório de time montado no
-- cliente viria zerado.
--
-- O que a protege: só devolve AGREGADO (nunca linha de negócio), e resolve o
-- workspace por my_workspace_ids() do próprio chamador, então não há parâmetro
-- de workspace para forjar.

create or replace function public.team_scoreboard(
  period_start date,
  period_end date
)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  deals_won bigint,
  value_won numeric,
  deals_open bigint,
  activities_done bigint,
  calls_made bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ws uuid;
begin
  select w into ws from unnest(public.my_workspace_ids()) as w limit 1;
  if ws is null then
    raise exception 'sem workspace';
  end if;

  return query
  select
    m.member_user_id as user_id,
    coalesce(m.name, m.email) as name,
    m.avatar_url,
    m.role,
    coalesce(won.n, 0) as deals_won,
    coalesce(won.v, 0) as value_won,
    coalesce(open_.n, 0) as deals_open,
    coalesce(act.n, 0) as activities_done,
    coalesce(cal.n, 0) as calls_made
  from public.workspace_members m
  left join lateral (
    select count(*) n, coalesce(sum(d.value), 0) v
      from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ganho' and d.deleted_at is null
       and d.updated_at::date between period_start and period_end
  ) won on true
  left join lateral (
    select count(*) n from public.deals d
     where d.workspace_id = ws and d.owner_id = m.member_user_id
       and d.status = 'Ativo' and d.deleted_at is null
  ) open_ on true
  left join lateral (
    select count(*) n from public.activities a
     where a.workspace_id = ws and a.assignee_id = m.member_user_id
       and a.completed is true
       and a.date::date between period_start and period_end
  ) act on true
  left join lateral (
    select count(*) n from public.telephony_calls c
     where c.workspace_id = ws and c.user_id = m.member_user_id
       and c.created_at::date between period_start and period_end
  ) cal on true
  where m.workspace_id = ws
    and m.status = 'accepted'
    and m.member_user_id is not null
  order by coalesce(won.v, 0) desc, coalesce(m.name, m.email);
end;
$$;

revoke all on function public.team_scoreboard(date, date) from public;
grant execute on function public.team_scoreboard(date, date) to authenticated;
```

> `my_workspace_ids()` devolve um conjunto ou um array conforme a definição original. Se o `unnest` acima falhar, troque a resolução por `select workspace_id into ws from public.workspace_members where member_user_id = auth.uid() and status = 'accepted' limit 1;` — o resultado é o mesmo e não depende do formato do helper.

- [ ] **Step 4: Aplicar** — `mcp__supabase__apply_migration`, `name: team_scoreboard`.

- [ ] **Step 5: Rodar a asserção do Step 1 de novo**

Esperado: duas linhas (Joao Reis e Ana Clara), com os números do João preenchidos — **mesmo chamando como a Ana**, que é o objetivo.

- [ ] **Step 6: Conferir que não vaza entre workspaces**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"29a555c8-dad7-4d77-ab5e-cc2f59ba8261","role":"authenticated"}', true);
set local role authenticated;
select count(*) from team_scoreboard('2026-01-01'::date, '2026-12-31'::date);
rollback;
```

Esperado: `1` — o admin do outro workspace (`joao@pixeo.com.br`) vê só o time dele, nunca o seu.

- [ ] **Step 7: Regenerar tipos e commitar**

```bash
npx supabase gen types typescript --project-id etdkzpiehoivrviylemd > src/lib/supabase/database.types.ts
npx tsc --noEmit
git add supabase/migrations/20260827100400_team_scoreboard.sql src/lib/supabase/database.types.ts
git commit -m "feat(insights): RPC team_scoreboard com o placar agregado

Única superfície que fura a RLS de propósito, para que o vendedor veja
o comparativo do time. Só devolve agregado e resolve o workspace pelo
próprio chamador -- não há parâmetro de workspace para forjar."
```

---

### Task 17: Painel Placar do time

**Files:**
- Create: `src/app/insights/team-scoreboard.tsx`
- Modify: `src/app/insights/panel-view.tsx` (montar o painel)

**Interfaces:**
- Consumes: RPC `team_scoreboard` (Task 16), `OwnerBadge` (Task 5).

- [ ] **Step 1: Escrever o componente**

```tsx
// src/app/insights/team-scoreboard.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OwnerBadge } from "@/components/team/owner-badge";
import { cn } from "@/lib/utils";

interface Row {
  user_id: string;
  name: string;
  deals_won: number;
  value_won: number;
  deals_open: number;
  activities_done: number;
  calls_made: number;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Placar do time. Visível para todos os papéis de propósito: o vendedor vê o
 * detalhe só dele, mas o comparativo agregado é o que dá contexto ao número
 * dele. Vem da RPC porque a RLS impede montar isso no cliente.
 */
export function TeamScoreboard({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc("team_scoreboard", {
        period_start: periodStart,
        period_end: periodEnd,
      });
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [periodStart, periodEnd]);

  if (loading) return <div className="p-6 text-xs text-zinc-400">Carregando placar...</div>;
  if (error) return <div className="p-6 text-xs text-red-500">Não foi possível carregar o placar: {error}</div>;
  if (rows.length === 0) return <div className="p-6 text-xs text-zinc-400">Nenhum membro ativo no período.</div>;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h3 className="text-sm font-bold text-zinc-900">Placar do time</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80">
              {["", "VENDEDOR", "GANHOS", "VALOR", "ABERTOS", "ATIVIDADES", "LIGAÇÕES"].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r, i) => (
              <tr key={r.user_id} className="hover:bg-zinc-50/30">
                <td className={cn("px-4 py-3 text-xs font-bold w-8", i === 0 ? "text-amber-500" : "text-zinc-300")}>
                  {i + 1}
                </td>
                <td className="px-4 py-3"><OwnerBadge ownerId={r.user_id} size="md" /></td>
                <td className="px-4 py-3 text-[13px] font-bold text-zinc-800">{r.deals_won}</td>
                <td className="px-4 py-3 text-[13px] font-bold text-emerald-600">{brl(Number(r.value_won))}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.deals_open}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.activities_done}</td>
                <td className="px-4 py-3 text-[13px] text-zinc-500">{r.calls_made}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Montar em `panel-view.tsx`**

Importar e renderizar abaixo dos painéis existentes, passando o período já calculado naquela tela. Se o período estiver como label ("Este mês") em vez de datas, derive `periodStart`/`periodEnd` com `date-fns` (`startOfMonth`/`endOfMonth`), que já é dependência do projeto.

- [ ] **Step 3: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Abrir `/insights` como admin e como vendedor. Esperado: os dois veem a tabela com os dois nomes e os mesmos números.

- [ ] **Step 4: Commitar**

```bash
git add src/app/insights/team-scoreboard.tsx src/app/insights/panel-view.tsx
git commit -m "feat(insights): painel Placar do time"
```

---

### Task 18: Escopo por papel em Insights, Metas, Forecast e Ligações

**Files:**
- Modify: `src/app/insights/panel-view.tsx:27-30,107-125`
- Modify: `src/app/insights/reports/[id]/report-viewer.tsx:38`
- Modify: `src/app/ligacoes/page.tsx:50,302`
- Modify: `src/app/metas/page.tsx:68-75`
- Modify: `src/app/forecast/page.tsx`

**Interfaces:**
- Consumes: `useTeam()` (`isManager`, `self`).

- [ ] **Step 1: Travar o seletor de dono em Insights**

Em `panel-view.tsx`, trocar `useOwnerNameMap` por `useTeam`, e o estado inicial:

```tsx
const { members, self, isManager } = useTeam();
// Vendedor não escolhe de quem é o relatório: a RLS já devolveria vazio para
// os outros, e um seletor que sempre zera parece defeito.
const [owner, setOwner] = useState<string>(() => (isManager ? ALL_USERS : self?.name ?? ALL_USERS));
```

Envolver o dropdown de dono (linhas ~107-125) em `{isManager && ( ... )}`, e quando não for manager renderizar no lugar um rótulo estático com o nome próprio.

- [ ] **Step 2: Reagir a `self` chegar depois**

`useTeam` carrega assíncrono, então `self` começa nulo. Acrescentar:

```tsx
useEffect(() => {
  if (!isManager && self?.name) setOwner(self.name);
}, [isManager, self?.name]);
```

- [ ] **Step 3: Travar o seletor em `report-viewer.tsx`**

Trocar a linha 38 de `src/app/insights/reports/[id]/report-viewer.tsx`:

```tsx
const { map: ownerNameMap, members, self, isManager } = useTeam();
const ownerNames = members.map((m) => m.name);
```

Onde a tela renderiza a lista de donos para escolha, envolver em `{isManager && ( ... )}` e, no ramo do vendedor, renderizar o rótulo fixo:

```tsx
{!isManager && (
  <span className="text-xs font-medium text-zinc-600">{self?.name ?? ""}</span>
)}
```

E onde o relatório recebe o dono selecionado, garantir que o vendedor não consiga sair do próprio:

```tsx
const effectiveOwner = isManager ? owner : (self?.name ?? owner);
```

usando `effectiveOwner` no lugar de `owner` ao montar os overrides do relatório.

- [ ] **Step 4: Travar o seletor em `ligacoes/page.tsx`**

Trocar a linha 50:

```tsx
const { map: sellerMap, members, self, isManager } = useTeam();
const sellerNames = members.map((m) => m.name);
```

Envolver o bloco da linha 302 que faz `sellerNames.map(...)`:

```tsx
{isManager && sellerNames.map((name) => (
  // ...conteúdo existente, inalterado...
))}
```

E, para o vendedor, fixar o filtro no próprio nome no estado inicial:

```tsx
const [sellerFilter, setSellerFilter] = useState<string>(() => (isManager ? "" : self?.name ?? ""));

useEffect(() => {
  if (!isManager && self?.name) setSellerFilter(self.name);
}, [isManager, self?.name]);
```

(Se o estado do filtro tiver outro nome naquele arquivo, use o nome existente — a mudança é o valor inicial e o `useEffect`, não a renomeação.)

- [ ] **Step 5: Travar o seletor em `forecast/page.tsx`**

Essa tela hoje não tem seletor de vendedor nenhum (nenhuma ocorrência de `owner` no arquivo). Como gerente e admin passam a poder segmentar, adicione o mesmo controle da Task 13:

```tsx
const { isManager } = useTeam();
const [ownerFilter, setOwnerFilter] = useState<string | null>(null);

// no cabeçalho:
{isManager && (
  <OwnerSelect
    value={ownerFilter}
    onChange={setOwnerFilter}
    allowUnassigned
    unassignedLabel="Todos os vendedores"
    className="w-44"
  />
)}
```

e aplique `.filter(d => (ownerFilter ? d.ownerId === ownerFilter : true))` na cadeia de negócios que a tela já monta. Para o vendedor nada muda: a RLS já entrega só a carteira dele.

- [ ] **Step 6: Metas — não permitir criar meta para outro sem ser gerente**

Em `src/app/metas/page.tsx`, o seletor de dono (linha ~468) já lê `workspace_members`. Envolvê-lo:

```tsx
{isManager && (
  <select
    value={formData.ownerUserId}
    onChange={(e) => setFormData((prev) => ({ ...prev, ownerUserId: e.target.value }))}
    // ...resto inalterado...
  />
)}
```

e, para o vendedor, fixar o dono no próprio id ao abrir o formulário:

```tsx
useEffect(() => {
  if (!isManager && self?.id) setFormData((prev) => ({ ...prev, ownerUserId: self.id }));
}, [isManager, self?.id]);
```

com `const { self, isManager } = useTeam();` no topo do componente.

- [ ] **Step 7: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Percorrer as cinco telas como vendedor: nenhum seletor de outra pessoa aparece, e os números batem com os dele. Como admin: tudo continua como antes, mais o seletor novo em Forecast.

- [ ] **Step 8: Commitar**

```bash
git add src/app/insights/panel-view.tsx src/app/insights/reports/\[id\]/report-viewer.tsx src/app/ligacoes/page.tsx src/app/metas/page.tsx src/app/forecast/page.tsx
git commit -m "feat(relatorios): escopo por papel em Insights, Metas, Forecast e Ligações

Seletor de vendedor só para gerente e admin. Para vendedor o seletor
era enganoso: a RLS devolve vazio para os outros, então escolher outra
pessoa zerava o relatório e parecia defeito."
```

---

### Task 19: Identidade — convite e perfil

**Files:**
- Modify: `src/app/api/convites/aceitar/route.ts:64`
- Modify: `src/app/configuracoes/perfil/page.tsx:60,115-118`

**Interfaces:**
- Consumes: `workspace_members.avatar_url` (Task 2).

- [ ] **Step 1: Corrigir a chave no aceite de convite**

Em `src/app/api/convites/aceitar/route.ts`, linha 64:

```ts
      // full_name, não name: é a chave que o app inteiro lê. Gravar `name`
      // fazia todo convidado aparecer pelo email até alguém notar.
      user_metadata: name ? { full_name: name, name } : undefined,
```

- [ ] **Step 2: Gravar o avatar em `workspace_members` no aceite**

Logo abaixo, no `update` de `workspace_members`, nada muda (o `name` já é gravado ali). Confirme que continua.

- [ ] **Step 3: Sincronizar nome no Perfil**

Em `src/app/configuracoes/perfil/page.tsx`, depois do `supabase.auth.updateUser({ data: { full_name: next } })` (linha 60):

```ts
    // Os colegas leem workspace_members.name, não o metadata -- sem este
    // espelho, mudar o nome aqui não muda nada para o resto do time.
    await supabase
      .from("workspace_members")
      .update({ name: next })
      .eq("member_user_id", userId);
```

- [ ] **Step 4: Sincronizar avatar no Perfil**

Depois do `updateUser({ data: { avatar_url: publicUrl } })` (linha ~115):

```ts
    await supabase
      .from("workspace_members")
      .update({ avatar_url: publicUrl })
      .eq("member_user_id", userId);
```

- [ ] **Step 5: Verificar compilação e navegador**

```bash
npx tsc --noEmit && npm run build
```

Trocar o próprio nome em `/configuracoes/perfil`, depois abrir `/conversas` e confirmar que o dropdown de vendedores mostra o nome novo. Conferir também:

```sql
select member_user_id, name, avatar_url from workspace_members
 where workspace_id = '5e0c7833-819c-4f39-8864-12ab0fb17093';
```

- [ ] **Step 6: Commitar**

```bash
git add src/app/api/convites/aceitar/route.ts src/app/configuracoes/perfil/page.tsx
git commit -m "fix(identidade): convite grava full_name e o perfil espelha no time

O aceite gravava user_metadata.name; o app inteiro lê full_name, então
todo convidado aparecia pelo email. O perfil atualizava só o metadata,
que os colegas não leem -- passa a espelhar nome e avatar em
workspace_members."
```

---

### Task 20: Verificação final de ponta a ponta

**Files:** nenhum (só verificação).

- [ ] **Step 1: Build limpo**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 2: Varredura de RLS por papel**

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"0c68aa6d-be0c-468d-9a7d-fed10ace1887","role":"authenticated"}', true);
set local role authenticated;
select 'deals' t, count(*) from deals
union all select 'activities', count(*) from activities
union all select 'telephony_calls', count(*) from telephony_calls
union all select 'whatsapp_conversations', count(*) from whatsapp_conversations
union all select 'contacts', count(*) from contacts
union all select 'workspace_members', count(*) from workspace_members;
rollback;
```

Esperado para a Ana (vendedora): `deals` só os dela; `activities` só onde é responsável ou dona do negócio; `telephony_calls` só as dela; `whatsapp_conversations` as dela mais as da fila; `contacts` todos (compartilhado por decisão); `workspace_members` 2.

Repetir com o id do João e esperar os totais do workspace.

- [ ] **Step 3: Roteiro no navegador, dois papéis**

Como **admin**: dropdown de vendedores lista os dois nomes em Conversas; balão mostra autor certo; reatribuir negócio persiste; filtro de Atividades filtra; placar aparece em Insights.

Como **vendedor** (Ana): sem QR nem botão de desconectar em Configurações › WhatsApp; toggle da própria assinatura funciona; mensagem enviada por ela sai com `*Ana Clara*:`; aba Fila mostra as conversas órfãs; assumir uma tira ela da fila; sem seletor de outra pessoa em Insights, Metas, Forecast e Ligações; placar do time visível.

- [ ] **Step 4: Atualizar o grafo do repositório**

```bash
graphify . --update
```

- [ ] **Step 5: Commit final e resumo**

```bash
git add -A && git commit -m "chore: reindexa o grafo após a individualização multiusuário"
git log --oneline main..HEAD
```

Não publique. O deploy neste projeto é manual (`vercel deploy --prod`) e é decisão do usuário.

---

## Notas de execução

**Ordem importa.** As tarefas 1-3 são migrations independentes entre si, mas a 4 depende da 2 (`avatar_url`), a 6 depende da 2 (`whatsapp_member_settings`), e todas as tarefas de interface dependem da 4 e da 5.

**Cada fase é publicável.** Depois da Task 10, a Fase 1 está completa e pode ir a produção sozinha. O mesmo para a Task 15 e a Task 19.

**Se uma asserção SQL passar antes da migration**, pare: ou a migration já foi aplicada, ou a asserção está errada. Não siga adiante assumindo sucesso.

**Nada de framework de teste.** Se a tentação de instalar vitest aparecer no meio, ela está fora do escopo deste plano e do que o usuário pediu.
