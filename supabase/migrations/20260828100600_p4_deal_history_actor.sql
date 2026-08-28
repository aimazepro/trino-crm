-- P4 — `deal_history` não tinha coluna de autor.
--
-- `contact_history` e `company_history` têm `actor_user_id`; `deal_history`
-- não tinha, e por isso o histórico do negócio mostra só a data. Carimbar com
-- o nome de quem abriu a tela chegou a ser tentado e mostrava o histórico da
-- Ana assinado por outra pessoa -- o certo era não inventar autoria, que é o
-- que a UI faz hoje.
--
-- Sem backfill de propósito: o histórico velho não tem de onde tirar o autor,
-- e preencher com o admin inventaria a informação que a coluna existe para
-- registrar. Fica nulo para sempre, e a tela continua mostrando só a data
-- nessas linhas.
--
-- Nulo também é o valor das entradas escritas pelo motor de automações e
-- pelos webhooks de e-mail, que rodam com service role e não têm pessoa por
-- trás. A descrição dessas linhas já diz de onde vieram.

alter table public.deal_history
  add column if not exists actor_user_id uuid;

create index if not exists deal_history_actor_idx
  on public.deal_history (actor_user_id);
