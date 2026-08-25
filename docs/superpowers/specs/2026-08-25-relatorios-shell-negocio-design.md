# Relatórios (Insights) — Shell + Negócio — design

**Status:** aprovado, pronto para plano de implementação
**Origem:** pedido direto do dono — comparar `/insights` atual com o HTML/comportamento de um concorrente (compartilhado na conversa, telas "Adicionar novo relatório", sidebar de 35 relatórios, páginas de relatório individuais) e deixar igual e funcional.
**Escopo:** primeira fatia de um sistema de Relatórios maior. Cobre: builder shell (modal entidade+tipo, rotas reais por relatório, sidebar com Painéis+Relatórios), catálogo completo de **Negócio** (8 tipos, todos com cálculo real, sem mock), e só os 2 tipos de **Atividade** necessários pro seed padrão bater com o do concorrente (Mix de Atividades, Atividades por Responsável). Contato e Empresa ficam de fora — próxima fatia.

## Contexto

`/insights` hoje (`src/app/insights/`) é um protótipo: um único tipo de relatório (gráfico preso a `pipeline: string`), estado 100% client-side (`activeReportId` em `useState`, sem rota própria), fallback pra números mockados quando não há negócios (`{leads:2, decisor:0,...}`), e "Criar relatórios padrão" gera 20 relatórios genéricos (bar/funnel/stacked) via `DEFAULT_REPORTS` em `insights-constants.ts`.

O concorrente (referência trazida pelo dono) tem: modal "Adicionar novo relatório" com 2 colunas (entidade → tipo), cada relatório é uma rota própria (`/insights/reports/{id}`), "Criar relatórios padrão" gera ~35 relatórios reais, e o viewer de cada relatório tem controles genéricos (Medir por / Ver por / granularidade) em vez de um relatório-modelo fixo por tipo.

Persistência já é real: tabela `saved_reports` (`id, user_id, workspace_id, name, config jsonb, created_at`) existe e funciona via `useSavedReports` (`src/hooks/use-saved-reports.ts`) — **sem migration necessária**, `config` é jsonb e só precisa crescer com novos campos.

Schema já suporta os 8 tipos de Negócio sem dado novo: `deals` tem `probability`, `expected_close_date`, `loss_reason_id`, `stage_entered_at`; `deal_history` loga toda troca de etapa (`description = "Etapa alterada"`, `subtext = "De {origem} para {destino}"`, `created_at` real); `loss_reasons` tem FK real; `activities` tem `deal_id`, `type`, `created_at`, `assignee_id`, `completed`.

## 1. Modelo de dado

`saved_reports.config` (jsonb) cresce com:

```ts
interface ReportConfig {
  entity: "deal" | "activity";       // novo — driver do catálogo de tipos e dos filtros disponíveis
  reportType: string;                 // novo — chave do template (ex. "desempenho", "ganho_perda", "em_branco")
  chartType: "bar" | "stacked" | "funnel" | "pie" | "table" | "number";
  color: string;
  pipeline: string;                   // mantém — nome do pipeline pro seed por-funil; "" = sem filtro de funil
  period: string;                     // período base (Este mes / Este ano / Ultimos 7 dias / ...)
  periodField: "created_at" | "closed_at"; // novo — "Negocio criado em" vs "Negocio fechado em" / "Data de criacao"
  filters: { field: string; operator: string; value: string }[];
  measureBy?: "count" | "value";      // novo — só Negócio; Atividade é sempre count
  groupBy?: string;                   // novo — "Ver por": etapa | responsavel | status | created_at | closed_at | none
  groupByGranularity?: "day" | "week" | "month"; // novo — só aparece quando groupBy é campo de data
  excludeStage?: string;              // novo — só reportType "funil_conversao"
}
```

Campos novos são opcionais com fallback (`entity ?? "deal"`, `reportType ?? "em_branco"`) pra não quebrar relatórios já salvos.

## 2. Rotas

- `/insights` — dashboard "Meu Painel" (mantém, vira leitura de `?report=null`).
- `/insights/reports/new` — página com o modal "Adicionar novo relatório" (ver seção 4). Ao confirmar, cria a linha em `saved_reports` e navega pra `/insights/reports/{id}`.
- `/insights/reports/[id]` — viewer/editor do relatório. Substitui o toggle `activeReportId` atual.

Sidebar (`insights-sidebar.tsx`) e cards do dashboard (`dashboard-grid.tsx`) trocam `onClick`/estado por `<Link href="/insights/reports/{id}">` real.

## 3. Modal "Adicionar novo relatório"

Layout 2 colunas (`ESCOLHER ENTIDADE` / `ESCOLHER TIPO DE RELATORIO`), botões Cancelar/Continuar — réplica direta do que foi mandado.

**Entidades no seletor:** Negócio ($ icon), Atividade (calendar), Contato (person), Empresa (building) — os 4 aparecem na lista (bate visualmente com o concorrente), mas só **Negócio** e **Atividade** têm tipos reais nessa fatia. Contato/Empresa mostram só "Em branco" (usa o builder livre genérico) até a próxima fatia — não bloqueiam a UI, só têm catálogo menor.

**Tipos — Negócio** (título + descrição, iguais ao que foi mandado):
1. Em branco — builder livre (reaproveita period+filters+chartType manual, é o que já existe hoje)
2. Desempenho
3. Funil de Conversão
4. Ganho × Perda
5. Duração por Etapa
6. Movimentação por Etapa
7. Forecast / Pipeline ponderado
8. Tempo de Resposta

**Tipos — Atividade** (só os 2 usados no seed viram reais; os outros do modal do concorrente — Por Responsável, Por Tipo, Conclusão por Responsável, Volume Diário — aparecem na lista mas caem no builder "Em branco" genérico por ora):
1. Em branco
2. Mix de Atividades *(real)*
3. Atividades por Responsável *(real)*
4. Por Responsável, Por Tipo, Conclusão por Responsável, Volume Diário *(entram como "Em branco" com groupBy pré-selecionado)*

## 4. Catálogo de tipos — definição de cálculo

Cada tipo é uma função `(deals, activities, pipelines, ownerNameMap, config) => ChartData`, registrada em `src/app/insights/report-types/negocio.ts` e `.../atividade.ts`.

- **Desempenho** — conta negócios por `created_at` (Iniciados), `status="Ganho"` por data de fechamento (Ganhos), `status="Perdido"` por data de fechamento (Perdidos), agrupados por dia/semana/mês (3 séries, barras empilhadas ou agrupadas).
- **Funil de Conversão** — já existe (contagem por etapa do pipeline filtrado, negócios ativos). Ganha "Taxa de ganho: X%" (ganhos / total do funil) e "Excluir etapa" (remove 1 etapa do array antes de plotar).
- **Ganho × Perda** — `status in (Ganho, Perdido)` no período; conta/valor por status (pizza ou barra); quebra por `loss_reasons.label` via `deals.loss_reason_id` quando `groupBy = "loss_reason"`.
- **Duração por Etapa** — reconstrói segmentos por negócio a partir de `deal_history` filtrado em `description = "Etapa alterada"`, ordenado por `created_at`; duração de cada segmento = diff entre eventos consecutivos (último segmento vai até `now()` se aberto, ou até o evento de Ganho/Perdido). Nome da etapa de cada segmento vem do `subtext` (regex `/^De (.+) para (.+)$/`, usa o grupo 2; primeiro segmento assume a 1ª etapa do pipeline na criação). Média por etapa, em dias.
- **Movimentação por Etapa** — mesmos eventos de `deal_history`; por etapa e período: entradas (subtext bate "para {etapa}"), saídas (bate "de {etapa}"), progressão/regressão via comparação de `pipeline_stages.order` entre origem e destino (nomes resolvidos por `pipeline_stages.name`).
- **Forecast / Pipeline ponderado** — negócios `status="Ativo"`, Σ `value * (probability/100)`, agrupado por mês de `expected_close_date` (nulo cai num bucket "Sem previsão").
- **Tempo de Resposta** — por negócio, primeira `activities` (`min(created_at)` do deal) menos `deals.created_at`; média em horas. Sem telefonia — conta qualquer tipo de atividade.
- **Mix de Atividades** (Atividade) — conta `activities` por `type` (Ligação/Email/WhatsApp/Reunião/...) no período, barras empilhadas.
- **Atividades por Responsável** (Atividade) — conta `activities` por `assignee_id` (nome via `ownerNameMap`), concluídas vs pendentes (`completed`).

## 5. Viewer — controles novos

- **Sem botão "Salvar"** — toda mudança (chart type, cor, filtro, medir por, ver por) persiste na hora via `sync()` (já existe em `use-saved-reports.ts`), debounced ~500ms.
- **Barra de filtros**: badge de entidade (`NEGOCIO`/`ATIVIDADE` no singular pro período base, `NEGOCIOS`/`ATIVIDADES` no plural pros filtros extra — mesmo padrão visual do concorrente), período base ("Negócio criado em"/"Data de criação" + dropdown de período), filtros adicionais removíveis com `X`.
- **Operador de data vazia** — `"está vazio"` / `"não está vazio"` como operador válido pra campos de data (usado por "Negócio fechado em está vazio" = negócio aberto). Adiciona ao `FILTER_OPERATORS` do campo.
- **"Medir por" / "Ver por"** — barra acima do gráfico. Medir por: Quantidade | Valor (R$) — só Negócio. Ver por: Etapa | Responsável | Status | Negócio criado em | Negócio fechado em | Sem agrupamento — muda o `groupBy` e reprocessa o chart em cliente. Quando `groupBy` é campo de data, mostra 3º seletor de granularidade (Por dia/semana/mês) + aviso: *"As barras estão agrupadas por '{campo}', que é uma data diferente do período. Podem aparecer barras de fora do período selecionado."*
- **"Excluir etapa"** — só quando `reportType = "funil_conversao"`.
- Ícones dos botões de tipo de gráfico trocam pra bater exato: Funil usa `GitBranchPlus` (não `GitBranch`), Pizza usa `ChartPie` (não `PieChart` do recharts), Tabela usa `Table2`.

## 6. Sidebar / Painéis

`insights-sidebar.tsx`: "Meu Painel" ganha botão renomear (`Pencil`, mesmo padrão dos relatórios) — hoje só tem excluir.

## 7. Seed padrão ("Criar relatórios padrão")

Reconstrói `DEFAULT_REPORTS` como função de `state.pipelines`, não array fixo:

```
Para cada pipeline do workspace:
  Funil de Conversão, Leads Ganhos (número), Reuniões Agendadas,
  Novos Leads no Funil, Negócios Abertos por Etapa (Negócio, filtro "Negócio fechado em está vazio"),
  Mix de Atividades (Atividade), Atividades por Responsável (Atividade)
+ 5 relatórios globais (sem filtro de funil):
  Ganhos vs Perdidos (pizza, Ver por Status), Receita Mensal (Medir por Valor, Ver por Negócio fechado em, Por mês),
  Negócios Criados por Dia, Receita por Responsável, Negócios por Responsável
```

Total varia com nº de pipelines do workspace (não persegue "35" fixo — isso é artefato de o concorrente ter 4 pipelines de demo).

## 8. Fora de escopo (próximas fatias)

Contato e Empresa (catálogo + calculadoras reais), múltiplos Painéis customizados (hoje só "Meu Painel"), drag-reorder + resize persistido nas colunas da tabela de Registros, modal "Personalizar colunas" no viewer de relatório, botão "Analisar com IA".
