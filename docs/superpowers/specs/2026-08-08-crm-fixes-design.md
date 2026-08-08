# CRM fixes — dashboard, tempo de etapa, atividades, histórico, pipeline switch, campos

**Status:** approved
**Date:** 2026-08-08

## Contexto

Lote de correções/funcionalidades no trino-crm (Next.js + Supabase), levantadas pelo dono do produto a partir do uso real do app comparado a um concorrente. Seis frentes independentes, ordenadas por tamanho:

1. Dashboard "Negócios por Etapa" mostrando etapas vazias
2. Indicador de tempo na etapa fictício (não reflete tempo real, sem cor)
3. Falta aba "Todos" no negócio + modal de atividade desatualizado
4. Histórico incompleto (só negócio, só mudança de etapa)
5. Impossível trocar negócio de pipeline (só troca etapa dentro da mesma)
6. Bugs em Campos de dados (grupo/campo não persiste exclusão, "Obrigatório" não é validado)

"Conversas" foi checado e já funciona (estado vazio + link pra conectar WhatsApp) — fora de escopo.

## 1. Dashboard "Negócios por Etapa"

**Arquivo:** `src/app/page.tsx` (`pipelineStageData`, ~linha 88)

Hoje itera `state.pipelines` inteiro e `pipeline.stages` inteiro, sem filtro — por isso aparecem pipelines e etapas sem nenhum negócio. Fix:

- Calcular `stages` normalmente (com `count`/`value`), depois `.filter(s => s.count > 0)`.
- Excluir da lista pipelines cujo resultado filtrado ficou vazio.
- Mensagem "Nenhum negócio ainda" continua para quando a lista final for `[]`.

Não mexe no board Kanban (`/negocios`) — lá as colunas vazias continuam aparecendo, é o board de trabalho onde faz sentido ver todas as etapas pra poder arrastar card pra qualquer uma.

## 2. Indicador real de tempo na etapa

**Arquivos:** `src/hooks/use-crm-mutations.ts` (`moveDeal`), `src/lib/crm-transforms.ts`, `src/components/kanban/kanban-board.tsx`, `src/components/deal/deal-sidebar.tsx`

Causa raiz: `deals.stage_entered_at` existe no banco mas `moveDeal` nunca escreve nele (só zera `days_in_stage`). `daysInStage` fica um contador estático.

- `moveDeal`: ao mover, `update({ stage_id, stage_entered_at: now, days_in_stage: 0 })`.
- Parar de depender de `days_in_stage` armazenado — calcular no client: `daysInStage = diffInDays(now, deal.stageEnteredAt)`. Expor `stageEnteredAt` no tipo `Deal` (transform já teria a coluna disponível).
- Cor por etapa usa `stage.maxDays` (já existe, editável em `/negocios/configuracoes`, default 7):
  - `daysInStage >= maxDays` → vermelho
  - `daysInStage >= maxDays / 2` → amarelo
  - senão → neutro (cinza atual)
- Aplicar no badge `{deal.daysInStage}d` do card Kanban ([kanban-board.tsx:188](../../../src/components/kanban/kanban-board.tsx#L188)) e no campo "Na etapa" da sidebar do negócio.

## 3. Aba "Todos" + modal de atividade

**Arquivos:** `src/components/deal/deal-tabs.tsx`, `src/components/deal/activity-modal.tsx`, novo `src/components/deal/all-tab.tsx`

- Nova aba **"Todos"**, primeira da lista e aba padrão ao abrir o negócio (troca o `useState("Atividades")` inicial).
- Conteúdo: seção colapsável "Próximas atividades" (pendentes, ordenadas por data, com ação rápida "Agendar atividade" quando vazio) + seção colapsável "Linha do tempo" (mesma renderização usada na aba Histórico, todos os eventos incluindo os novos do item 4).
- Modal de atividade (`ActivityModal`), campos novos/ajustados:
  - Data e horário: trocar `datetime-local` único por Data + Início (HH:mm) + Fim (HH:mm), com texto "Deixe a hora em branco para um lembrete sem horário" — fim opcional.
  - Anexos: upload real via Supabase Storage (bucket novo `activity-attachments`, público-por-signed-url igual ao resto do app), lista de arquivos anexados, botão remover.
  - Responsável: dropdown real (self + `team_members` ativos do workspace), não mais `<select>` fixo.
  - Checkbox "Marcar como feito" — ao marcar, salva `completed: true` direto na criação.
  - Regra de negócio, tela e Salvar continuam iguais (mesma validação de título obrigatório).

## 4. Histórico completo

**Arquivos:** `src/hooks/use-crm-mutations.ts`, nova migration `contact_history`/`company_history`, `src/app/contatos/[id]/page.tsx`, `src/app/empresas/[id]/page.tsx`

- Expandir eventos logados em `deal_history` (hoje só criação/etapa/ganho-perdido): nota criada/editada/apagada, atividade criada/concluída/apagada, produto adicionado/removido, campo customizado alterado, dono alterado, contato/empresa vinculado ou desvinculado, pipeline alterada (item 5).
- Novas tabelas `contact_history` e `company_history`, mesma forma de `deal_history` (`id, contact_id|company_id, description, subtext, created_at`), RLS por `user_id` via join (ou coluna `user_id` direta, mais simples).
- Logar nelas as edições diretas de contato/empresa (campo alterado, negócio vinculado, etc.).
- As páginas de contato/empresa já têm aba "timeline" que mistura atividades e histórico dos negócios vinculados — estender a query pra incluir também `contact_history`/`company_history` da própria entidade.

## 5. Trocar negócio de pipeline

**Arquivo:** `src/app/negocios/[id]/page.tsx` (dropdown "Alterar Processo", ~linha 82)

Não existe hoje — o dropdown atual só lista etapas da pipeline atual. Construir fluxo de 2 passos dentro do mesmo dropdown:

1. Lista de pipelines (com busca), pipeline atual marcada.
2. Ao escolher outra pipeline, troca pra lista de etapas *daquela* pipeline (reaproveitando o componente de escolha de etapa já existente), com Cancelar/Salvar.
3. Salvar: `updateDealFields(dealId, { pipelineId, stageId })` — precisa de mutation nova ou extensão de `moveDeal` que aceite pipeline diferente; grava `stage_entered_at = now()` também (é uma troca de etapa implícita); loga histórico "Pipeline alterada: {de} → {para}".
4. Só habilitado quando `deal.status === "Ativo"` (mesma regra atual).

## 6. Campos de dados

**Arquivos:** `src/app/configuracoes/campos/page.tsx`, nova migration `custom_field_groups`

- **Grupos deixam de viver em localStorage.** Nova tabela `custom_field_groups (id, user_id, entity, name, sort_order)`. Criar/listar/apagar grupo vira CRUD real.
- Apagar grupo com campos dentro: bloquear com aviso "mova ou apague os campos primeiro" (mais simples e mais seguro que cascata silenciosa apagando campos do usuário).
- `handleRemoveField`/delete de campo: checar `error` retornado pelo Supabase antes de atualizar o estado local; em erro, manter o campo na lista e mostrar mensagem.
- Checkbox "Obrigatório": passa a ser validado de verdade — `DealCustomFields` (e equivalentes em contato/empresa, se existirem campos customizados lá) bloqueia salvar valor vazio em campo `required` e sinaliza visualmente quais estão faltando.

## Fora de escopo
- Conversas/WhatsApp (já funciona).
- Multi-seleção com opções configuráveis (não foi confirmado como o bug reportado; abrir chamado separado se for o caso).
