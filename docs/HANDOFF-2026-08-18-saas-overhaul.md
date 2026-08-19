# Handoff — Grande atualização SaaS (auditoria + multi-tenant + uazapi)

> Escrito em 2026-08-18 ao encerrar a sessão anterior por custo. A próxima sessão de IA deve ler este arquivo ANTES de explorar o repo — ele condensa o que já foi verificado e as decisões pendentes.

## O mandato do dono do produto (destilado, nas palavras dele)

1. **Análise profunda profissional** do SaaS inteiro: segurança, design, usabilidade.
2. **Tornar funcional tudo que é só decoração** — automações, webhooks, telas de configuração que não fazem nada de verdade. Inventariar o que falta e o que precisa melhorar.
3. **Multi-tenant**: cada pessoa que cria conta tem "um sistema desses" próprio (workspace isolado) e pode **adicionar múltiplos usuários com contas individuais** dentro dele.
4. **WhatsApp via uazapi** — cada conta/workspace conecta sua instância uazapi individual.
5. Objetivo final: **vender como produto**. Tudo real e funcional.
6. Instrução explícita dele: "qualquer dúvida me pergunte". Perguntar antes de assumir.

## Estado atual (verificado até 2026-08-18)

- Stack: Next.js 16.2.3 App Router + Supabase (projeto `etdkzpiehoivrviylemd`, "trinoCRM", us-east-1) + Vercel (team `aimaze`, projeto `trino-crm`, domínio `trino-crm.vercel.app`).
- Repo: `github.com/aimazepro/trino-crm`, branch única `main` (branches `dev` e `feat/deal-soft-delete-gaps` existem mas estão atrás). **Tag de segurança `v0.1.0-pre-saas` marca o estado pré-overhaul — foi criada exatamente pra poder voltar se a grande atualização der errado.**
- Modelo atual é **single-tenant-por-usuário**: quase toda tabela tem `user_id` direto (deals, activities, integrations, labels, companies...). RLS habilitado. Não existe conceito de workspace/organização/convite — a coluna `user_id` É a fronteira de isolamento hoje. A migração pra multi-tenant (workspace_id + membros + papéis) é a mudança estrutural mais profunda do mandato.
- Existe menção a `team_members` e `workspace_settings` em migrations antigas (`20260808052000_create_workspace_settings.sql`) — verificar o que já existe de semente de multi-tenancy antes de desenhar do zero.

### Funcional de verdade (confirmado nesta sessão)
- CRM core: pipelines, negócios (kanban), atividades, sequências com cadência, campos customizados, histórico, soft-delete de negócios.
- Gmail OAuth + envio (rotas `api/auth/gmail`, token AES-256-GCM via `src/lib/token-crypto.ts`, chave `OAUTH_ENCRYPTION_KEY` — precisa ser igual local e Vercel).
- Google Calendar sync (construído e revisado em 2026-08-12): push instantâneo CRM→Google com naming "Título — Negócio" e Meet automático (`src/lib/google-calendar.ts`, `src/lib/calendar-sync.ts`, rotas `api/calendar/sync-activity` e `api/calendar/sync-now`), pull manual via botão. Spec/plano em `docs/superpowers/specs|plans/2026-08-12-*`.
- `TimeField` (dropdown de horário) no modal de atividade e sequências.

### Fachada conhecida / suspeita (inventário INCOMPLETO — a auditoria precisa completar)
- **Cron de pull do Calendar**: rota `api/cron/calendar-pull` existe e funciona, mas SEM agendamento — Vercel Hobby só permite cron diário; o cron de 2min foi removido do `vercel.ts` porque quebrava TODO deploy. `CRON_SECRET` nunca foi setado em prod (rota falha fechado = inerte). Decisão pendente: Vercel Pro, scheduler externo, ou aceitar manual.
- **Automações**: `src/lib/run-automations.ts` existe e é chamado (`runAutomations("activity_created", ...)`) — grau de completude não auditado.
- **Webhooks**: só `src/app/api/webhooks/trigger/route.ts` — não auditado.
- **Conversas/WhatsApp**: em 2026-08-08 era estado vazio com link "conectar WhatsApp" (nada por trás). uazapi entra aqui.
- Página `configuracoes/telefone` e demais telas de configurações: não auditadas.

## Restrições operacionais (aprendidas a custo alto — NÃO redescobrir)

- **Vercel Hobby**: cron só 1x/dia. Cron mais frequente no `vercel.ts` = deploy do projeto INTEIRO falha na validação, antes do build.
- **Deploy é manual**: `git push` NÃO dispara deploy (sem integração Git ativa). Deploys via `npx vercel deploy --prod --yes`. Todos os deploys históricos são CLI (`aimazemachine-1968`).
- Sem framework de teste no repo (`package.json`: dev/build/start/lint). Verificação = `npx tsc --noEmit` + `npx eslint` + teste manual.
- Erros de lint pré-existentes conhecidos (fora de escopo até agora): `activity-modal.tsx:124/137` (set-state-in-effect), `use-crm-mutations.ts:153` (any).
- Dono do produto é sensível a custo de sessão: preferir execução inline a frotas de subagents; perguntar antes de fluxos multi-agente caros. Respostas em pt-BR.
- Migrations aplicadas direto no projeto Supabase live via MCP `apply_migration` (sem CLI local).

## Perguntas a fazer ANTES de desenhar (ele pediu que perguntassem)

1. **Modelo multi-tenant**: workspace com papéis (admin/membro)? Quais permissões diferem? Vendedor vê só os próprios negócios ou tudo do workspace?
2. **uazapi**: já tem conta/documentação/token de teste? Instância por workspace ou por usuário? O que o WhatsApp precisa fazer (só conversas? disparo em sequência/automação?).
3. **Cobrança**: vender como? Assinatura (Stripe?), por enquanto sem billing, ou licença manual? Afeta o desenho do signup.
4. **Vercel Pro**: vai assinar? Destrava cron do Calendar e crons de automação.
5. **Dados existentes**: os dados atuais (11 deals, 22 activities do dono) viram o primeiro workspace ou ambiente é zerado?

## Processo recomendado pra próxima sessão

1. Ler este arquivo + `CHANGELOG.md` + specs em `docs/superpowers/specs/`.
2. Rodar a auditoria (skill `ecc:production-audit` foi invocada mas não executada — refazer): inventário real de cada rota/tela (funcional × fachada), lente de segurança (a sessão passada já achou e corrigiu 1 rota sem auth — procurar padrões repetidos nas outras rotas), RLS × modelo multi-tenant futuro.
3. Apresentar diagnóstico + decomposição em sub-projetos (sugestão: 1. multi-tenancy/auth/convites → 2. hardening segurança → 3. uazapi → 4. automações/webhooks reais → 5. billing) — cada um com spec própria via brainstorming.
4. Perguntar as 5 perguntas acima antes de codar qualquer coisa.
