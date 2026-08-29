-- Painel admin da plataforma (super-admin): dá pra workspace um status
-- operável de fora (suspender/reativar/apagar sem tocar em dado) e um lugar
-- pra overrides de feature por cliente, sem tabela nova. Ausência de chave em
-- feature_flags = usa o default do plano (ver src/lib/feature-flags.ts).
alter table public.workspaces
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  add column feature_flags jsonb not null default '{}'::jsonb;

create index workspaces_status_idx on public.workspaces (status);
