-- Painel da plataforma v2 (ver docs/superpowers/specs/2026-08-30-painel-plataforma-design.md).
--
-- Três coisas de uma vez porque nascem juntas e não fazem sentido separadas:
-- quem opera o painel (platform_admins), o que cada operação fez
-- (platform_audit_log) e onde o Stripe vai encostar quando existir
-- (colunas em workspaces, sem nenhum código de Stripe agora).

create table public.platform_admins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete cascade,
  email        text not null unique,
  role         text not null check (role in ('owner','support','billing')),
  status       text not null default 'active' check (status in ('active','suspended')),
  created_at   timestamptz not null default now(),
  created_by   text,
  last_seen_at timestamptz
);

create table public.platform_audit_log (
  id           bigserial primary key,
  actor_email  text,
  actor_role   text,
  actor_via    text check (actor_via in ('session','token')),
  action       text not null,
  target_type  text,
  target_id    text,
  -- nome/e-mail no momento da ação: o log precisa continuar legível depois
  -- que o alvo for renomeado ou deixar de existir.
  target_label text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index platform_audit_log_created_at_idx on public.platform_audit_log (created_at desc);
create index platform_audit_log_target_idx on public.platform_audit_log (target_type, target_id);

-- Acesso só via service-role. RLS ligada sem policy nenhuma já barra
-- anon/authenticated, mas RLS não desfaz GRANT: sem o revoke abaixo, um
-- grant de tabela inteira herdado do schema continuaria valendo.
-- Lição de 34b69eb: revoke por coluna NÃO subtrai de grant de tabela.
alter table public.platform_admins enable row level security;
alter table public.platform_audit_log enable row level security;
revoke all on public.platform_admins from anon, authenticated;
revoke all on public.platform_audit_log from anon, authenticated;

-- Ganchos de Stripe. subscription_status = 'manual' significa "o plano foi
-- definido à mão no painel"; quando o Stripe entrar, ele passa a escrever
-- 'active'/'past_due'/'canceled' aqui sem migração nova.
alter table public.workspaces
  add column stripe_customer_id     text,
  add column stripe_subscription_id text,
  add column subscription_status    text not null default 'manual',
  add column current_period_end     timestamptz;

-- Semeia o operador que já existe hoje pela env var. Sem isso, ele aparece
-- como "conta órfã" no dashboard (auth.users sem workspace_members) e a
-- tabela nasce vazia, deixando toda autorização dependente da env.
-- Por e-mail, não por uuid hardcoded.
insert into public.platform_admins (user_id, email, role, created_by)
select id, email, 'owner', 'migration:20260830100000'
from auth.users
where lower(email) = 'tools@trinocompany.com.br'
on conflict (email) do nothing;
