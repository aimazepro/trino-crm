# Individualização multiusuário do TrinoCRM

**Data:** 2026-08-26
**Status:** design aprovado, aguardando plano de implementação

## Problema

O banco e as políticas RLS do TrinoCRM já são multi-tenant e multiusuário. A
camada de interface não é: ela foi escrita assumindo um único usuário por
workspace, e por isso atribui autoria errada, esconde membros do time e oferece
seletores de pessoa que não fazem nada.

O sintoma que motivou este trabalho: um segundo usuário (Ana Clara, `vendedor`)
foi convidado e aceitou o convite corretamente — está em `workspace_members`
com `status = accepted` e `member_user_id` preenchido. Ainda assim:

- o filtro "Todos os vendedores" em Conversas lista apenas "Joao Reis";
- mensagens enviadas por ela aparecem no thread como se fossem do admin;
- no WhatsApp do contato, a mensagem dela sai assinada com o nome do admin.

Nenhuma dessas três falhas está no banco. A mensagem dela tem
`sent_by = 0c68aa6d-…` gravado corretamente.

## Falhas identificadas na auditoria

### Atribuição e autoria

1. **Lista de vendedores derivada das conversas.** `teamNames` em
   `src/app/conversas/page.tsx:118-122` monta o dropdown a partir do
   `ownerName` das conversas carregadas. No banco há 4 conversas, 3 com
   `owner_id NULL` — logo a lista tem um nome só. Um vendedor sem conversa
   atribuída é invisível.

2. **Thread descarta a autoria.** `toMessage()` em
   `src/hooks/use-whatsapp-thread.ts:38-53` não copia `sent_by`. O `select("*")`
   traz o campo e o mapper o joga fora, então todo balão `from_me` renderiza
   idêntico.

3. **Assinatura pertence ao workspace, não a quem envia.** `applySignature`
   (`src/lib/whatsapp/types.ts:48-53`) usa `connection.signatureName`, um valor
   único para todo o workspace.

4. **Filtro de usuário em Atividades é decorativo.** `userFilter`
   (`src/app/atividades/page.tsx:66`) está declarado e ligado ao `<select>`, mas
   não participa de nenhum filtro. O `<select>` tem duas opções fixas e nenhuma
   lista de membros. Cada linha exibe `{selfName} (você)` fixo (`:363`), então
   tarefa de outro vendedor aparece como sua.

5. **Não existe forma de trocar o dono de um negócio pela interface.**
   `owner_id` é gravado na criação (`src/hooks/use-crm-mutations.ts:223`) e nunca
   mais. A tela de detalhe apenas exibe o dono. Só a automação `assign_owner` e a
   API v1 conseguem reatribuir.

6. **Negócios não filtra por vendedor.** `src/app/negocios/page.tsx` filtra
   apenas por status.

7. **Convite grava a chave errada.** `src/app/api/convites/aceitar/route.ts:64`
   grava `user_metadata: { name }`; o resto do app lê `full_name`. Confirmado no
   banco: Ana Clara tem `{"name":"Ana Clara","email_verified":true}`.

8. **Perfil não propaga o nome.** `src/app/configuracoes/perfil/page.tsx:60`
   atualiza apenas `auth.user_metadata`. Os colegas leem
   `workspace_members.name`, que fica desatualizado.

9. **Avatar só do próprio usuário.** `useOwnerNameMap`
   (`src/hooks/use-owner-name-map.ts:41`) preenche `avatars` apenas para
   `user.id`. Avatares vivem em `auth.users.user_metadata`, que o cliente não lê
   de outro usuário.

10. **Coluna "Proprietário" em Contatos é fixa.**
    `src/app/contatos/page.tsx:345` devolve sempre `currentUserName`.

### Falhas no banco encontradas durante o design

11. **RLS de `activities` ignora `assignee_id`.** As políticas checam apenas
    `deals.owner_id`. A coluna `assignee_id` existe, a API v1 a valida e o modal
    de atividade já tem seletor de responsável — mas o responsável designado não
    consegue ler a própria tarefa se o negócio for de outra pessoa.

12. **`sync_whatsapp_conversation_links` sobrescreve o dono da conversa.** O
    trigger grava `owner_id` do dono do negócio incondicionalmente e o zera para
    `NULL` quando o contato perde o último negócio vivo. Isso é incompatível com
    auto-claim.

13. **`telephony_calls` não tem escopo por usuário.** A política SELECT é apenas
    `workspace_id IN my_workspace_ids()`.

### Verificado e correto (não mexer)

`deals`, `deal_notes`, `emails`, `notifications` e `goals` têm RLS correta.
`workspace_members` permite que qualquer membro liste o time inteiro. A tela
Configurações › Usuários funciona. Metas, Insights e Ligações já consomem a
lista de membros. Ramais de telefonia são por `user_id`. Notificações usam canal
realtime por `user_id`. A automação `assign_owner` tem round-robin. A rota
`/api/v1/users` já trata `name` e `full_name`.

## Decisões

| Assunto | Decisão |
|---|---|
| WhatsApp | Um número compartilhado por workspace; dono por conversa. Não haverá número por vendedor. |
| Dono de conversa | Fila aberta com auto-claim: o primeiro que responder vira dono. Gerente/admin reatribuem. |
| Assinatura | Por usuário, com nome travado no nome do membro. Vendedor só liga/desliga. |
| Tela de WhatsApp para vendedor | Somente leitura do status de conexão, mais o toggle da própria assinatura. |
| Contatos e empresas | Continuam compartilhados. Ganham `owner_id` apenas informativo e filtrável. |
| Relatórios para vendedor | Detalhe próprio, mais um placar agregado do time. |
| Notificações | Mensagem nova notifica o dono da conversa; conversa na fila notifica todos. |

**Por que número compartilhado.** É o padrão de Kommo, RD Station Conversas,
Take Blip e Zenvia. O relacionamento pertence à empresa: se o vendedor sair, o
número e o histórico ficam — o que importa aqui porque a operação revende esses
leads para clientes da agência. O contato conhece um número só, e existe uma
fila de entrada real. Número por vendedor exigiria uma instância Evolution por
pessoa e entregaria a carteira ao vendedor.

## Arquitetura

Três fases, cada uma utilizável em produção ao final.

### Fase 1 — Fundação e WhatsApp

#### Migration

Tudo reusa os helpers existentes `my_workspace_ids()`, `is_ws_admin()` e
`is_ws_manager()`. Nenhuma tabela de papéis nova.

**Auto-claim.** Trigger `BEFORE INSERT ON whatsapp_messages`: quando
`NEW.from_me = true` e `NEW.sent_by IS NOT NULL` e a conversa alvo está com
`owner_id IS NULL`, grava `owner_id = NEW.sent_by`. Mensagens de automação e da
fila chegam com `sent_by = NULL`, então um robô nunca reivindica um lead.

**Correção de `sync_whatsapp_conversation_links`.** Passa a escrever `owner_id`
apenas quando ele já está nulo (`COALESCE(c.owner_id, best.owner_id)`), e deixa
de zerar o dono no ramo em que o contato perde o último negócio vivo. O dono
passa a ser de quem atendeu; o negócio deixa de ser autoridade sobre isso. A
sincronia de `deal_id` continua exatamente como está.

**Tabela `whatsapp_member_settings`.** Chave primária `(workspace_id, user_id)`,
mais `signature_enabled boolean not null default true`. Não tem coluna de nome:
a assinatura deriva de `workspace_members.name`, o que a trava por construção.
RLS: cada um lê e escreve a própria linha; gerente/admin leem todas.
`whatsapp_connections.signature_name` sobrevive como fallback para mensagem de
máquina, onde `sent_by` é nulo.

**`workspace_members.avatar_url`.** Coluna nova, `text null`. O bucket `avatars`
já é público, então guardar a URL pública aqui torna o avatar de qualquer membro
legível por qualquer membro sem rota de servidor.

**RLS de `activities`.** SELECT, UPDATE e DELETE passam a aceitar
`assignee_id = auth.uid()` além de `deals.owner_id = auth.uid()` e
`is_ws_manager()`.

**RLS de `telephony_calls`.** SELECT vira
`workspace_id IN my_workspace_ids() AND (user_id = auth.uid() OR is_ws_manager())`.

**Backfill de identidade.** Para cada `workspace_members` com `member_user_id`
não nulo cujo `auth.users.raw_user_meta_data` tenha `name` mas não `full_name`,
copiar `name` para `full_name`. Preencher `workspace_members.name` e
`avatar_url` a partir do metadata quando estiverem nulos.

#### Kit compartilhado

**`useTeam()`** (`src/hooks/use-team.ts`) substitui `useOwnerNameMap`. Devolve
`members` (id, nome, email, papel, avatarUrl), `map`, `avatars`, `self`
(id, nome, papel) e `isManager`. Lê `workspace_members` filtrando por
`workspace_id` do `useWorkspace()` e `status = 'accepted'`, e agora traz o
avatar de todos. `useOwnerNameMap` passa a ser um alias fino sobre `useTeam()`
para não quebrar os oito consumidores atuais de uma vez.

**`<OwnerSelect>`** — dropdown de membros ativos, com estados de carregamento e
vazio.
**`<OwnerBadge>`** — avatar mais nome, com iniciais como fallback.
**`<ScopeToggle>`** — alterna escopos, escondendo os que o papel não permite.

#### Conversas

Escopos passam a ser três: **Minhas** (`owner_id = self`), **Fila**
(`owner_id IS NULL`) e **Time** (tudo, renderizado apenas para gerente/admin).

O dropdown de vendedores passa a vir de `useTeam().members`, e o filtro compara
`ownerId`, não `ownerName` — comparar por nome quebra com homônimos e com nome
vazio.

`ThreadMessage` ganha `sentBy: string | null`, copiado em `toMessage()`. Balão
`from_me` exibe o autor via `<OwnerBadge>`; quando `sentBy` é nulo, exibe
"Automação".

O cabeçalho da conversa ganha "Assumir conversa" quando ela está na fila, e um
`<OwnerSelect>` de reatribuição visível apenas para gerente/admin.

`applySignature` passa a receber o nome de quem envia. `sendWhatsAppMessage`
resolve, a partir de `input.sentBy`, o `workspace_members.name` e o
`signature_enabled` daquele usuário. Sem `sentBy`, cai no comportamento atual da
conexão.

#### Tela de WhatsApp

Admin mantém a página atual inteira e ganha o toggle da própria assinatura.
Vendedor recebe uma variante somente leitura: card "Conectado · +55…" mais o
toggle da própria assinatura com preview `*Ana Clara*:`. Sem QR, sem
desconectar, sem trocar número, sem campo de nome, sem seção de grupos. A rota
`/api/whatsapp/settings` passa a aceitar `signatureEnabled` do próprio usuário
sem exigir admin, e continua exigindo admin para tudo o mais.

### Fase 2 — Negócios, Atividades, Contatos

**Migration.** `contacts.owner_id` e `companies.owner_id`, `uuid null` referenciando
`auth.users`. Backfill a partir do dono do negócio mais recente ligado ao
contato; empresa herda do contato mais recente. RLS de leitura não muda.

**Detalhe do negócio.** O texto estático de Proprietário vira `<OwnerSelect>`,
habilitado para o dono atual e para gerente/admin.

**Kanban e lista.** Filtro por vendedor no cabeçalho, renderizado apenas para
gerente/admin.

**Atividades.** `userFilter` passa a filtrar de fato por `assigneeId`, com as
opções vindas de `useTeam()`. A linha troca o `selfName` fixo por
`<OwnerBadge>` do responsável real.

**Contatos.** A coluna Proprietário passa a ler `owner_id`, e ganha filtro por
dono.

### Fase 3 — Relatórios, ranking, identidade

**RPC `team_scoreboard(period_start date, period_end date)`.** `SECURITY DEFINER`,
`SET search_path = public, pg_temp`. Resolve o workspace do chamador por
`my_workspace_ids()` e rejeita quem não for membro. Devolve, por vendedor:
negócios ganhos, valor ganho, negócios abertos, atividades concluídas e
ligações. É a única superfície que fura a RLS de propósito, e só expõe
agregados.

**Painel Placar do time** em Insights, visível para todos os papéis.

**Escopo por papel** em Insights, Metas, Forecast e Ligações: o seletor de
vendedor só renderiza para gerente/admin; vendedor fica preso ao próprio id.

**Identidade.** `src/app/api/convites/aceitar/route.ts` passa a gravar
`full_name`. A tela de Perfil passa a gravar nome e avatar também em
`workspace_members`.

## Fluxo de dados

**Mensagem recebida de número desconhecido.** Evolution → webhook → `ingest.ts`
cria a conversa com `owner_id = NULL` → aparece na aba Fila de todos os
vendedores e no Time do gerente → notifica todos.

**Vendedor responde.** UI → `POST /api/whatsapp/send` com a sessão dele →
`sendWhatsAppMessage` grava `sent_by = user.id` → trigger de auto-claim marca
`owner_id = sent_by` → conversa sai da fila dos outros e entra em "Minhas" dele
→ `applySignature` prefixa `*Ana Clara*:` se o toggle dela estiver ligado.

**Gerente reatribui.** `<OwnerSelect>` no cabeçalho → `UPDATE
whatsapp_conversations SET owner_id` → permitido pela política de UPDATE, que já
aceita `is_ws_manager()`.

**Mensagem da automação.** Fila → `sendWhatsAppMessage` com `sentBy: null` →
auto-claim não dispara, a conversa continua na fila → assinatura cai no fallback
da conexão.

## Erros e casos de borda

**Corrida no auto-claim.** Dois vendedores respondem ao mesmo tempo. O trigger
roda dentro da transação do INSERT; o segundo enxerga `owner_id` já preenchido e
não sobrescreve. Quem chegar depois perde a conversa da lista dele — a UI precisa
tratar isso como estado normal, não como erro, já que o Realtime vai empurrar a
mudança.

**Membro removido do workspace.** `owner_id` e `assignee_id` passam a apontar
para alguém que não é mais membro. `useTeam()` só lista `accepted`, então
`map[id]` fica indefinido. `<OwnerBadge>` renderiza "Usuário removido" em vez de
string vazia, e o filtro por dono continua funcionando pelo id.

**Vendedor abre link de negócio que não é dele.** A RLS já devolve vazio. A tela
precisa mostrar "Negócio não encontrado ou sem acesso", não quebrar.

**Assinatura sem nome.** Membro com `workspace_members.name` nulo (convite aceito
sem nome). `applySignature` cai no email antes do `@`, e nunca no nome da
conexão — assinar com o nome de outra pessoa é pior do que assinar com um nome
feio.

**Backfill de `full_name`.** Idempotente: só escreve quando `full_name` está
ausente. Rodar duas vezes não muda nada.

## Testes

**Migration.** Verificar em SQL, com `SET LOCAL role` e `request.jwt.claims`
simulando cada papel: vendedor não lê negócio alheio; vendedor lê a tarefa em
que é `assignee` num negócio alheio; vendedor lê a própria ligação e não a dos
outros; vendedor lê a conversa dele e a da fila, e não a de outro vendedor;
gerente lê tudo.

**Auto-claim.** Inserir mensagem com `sent_by` numa conversa sem dono e conferir
que o dono ficou correto; repetir com `sent_by = NULL` e conferir que continua
sem dono; inserir numa conversa que já tem dono e conferir que não sobrescreve.

**`sync_whatsapp_conversation_links`.** Reivindicar uma conversa, depois ligar um
negócio de outro dono ao mesmo contato, e conferir que o dono da conversa não
mudou.

**`team_scoreboard`.** Chamar como vendedor e conferir que devolve todos os
vendedores do workspace; chamar como membro de outro workspace e conferir que
rejeita.

**Interface.** Percorrer os dois papéis: dropdown de vendedores lista o time
inteiro mesmo sem conversa atribuída; balão mostra o autor certo; vendedor não
enxerga QR nem botão de desconectar; filtro de Atividades filtra de verdade;
reatribuição de negócio persiste.

## Fora de escopo

Número de WhatsApp por vendedor. Matriz de permissões editável (a coluna
`permissions` em `workspace_members` continua ignorada). Times ou hierarquia
dentro do workspace. Visibilidade individualizada de contatos e empresas.
Reescrita da tela de Duplicatas.
