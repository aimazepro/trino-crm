# Prompt para a próxima sessão (P5)

Copie o bloco abaixo inteiro como primeira mensagem da sessão nova.

> Atualizado em 2026-08-28 à noite, **depois** da passada do João no navegador.
> As versões anteriores deste bloco diziam que nenhuma tela tinha sido clicada
> — não é mais verdade. O que falta está no "Adendo 2", no fim do arquivo.

---

P5 do docs/TODO-2026-08-28-multiusuario-pendencias.md. Leia o documento
inteiro e depois os dois adendos no fim de
docs/PROMPT-PROXIMA-SESSAO-P5.md. **Não é para codar.**

**A passada do João já foi feita no navegador e passou inteira** — os 14
itens estão na tabela do Adendo 2, com os números vistos. Não repita.
Falta: (a) a passada da Ana, que é leitura pura, e (b) os doze itens de
escrita, que exigem autorização item a item.

Comece pedindo a senha da Ana (`claraferrodrigui@gmail.com`) e uma aba
aberta em `https://trino-crm.vercel.app/login`. As contas entram por
`signInWithPassword`; o Google OAuth do mesmo formulário não é dirigível.

Ordem: **leitura pura primeiro, com o banco intacto.** Como Ana —

1. Painel: **R$ 5.500 / 2 abertos** (é o cruzamento que pega o bug do P1
   — o admin filtrando ela viu o mesmo número), **sem** seletor de
   vendedor, e o **placar do time aparece com as 2 pessoas**.
2. `/automacoes`: some do menu, e a URL digitada mostra "Sem acesso".
   `/automacoes/nova` também.
3. As seis telas de Configurações do P2 — Campos de dados, Motivos de
   Perda, Motivos de Exclusão, Tipos de Atividade, Duplicatas,
   Sequências — somem do menu e cada URL mostra "Sem acesso".
4. **Produtos continua no menu e abre**, mas sem "Novo Produto", sem
   "Criar primeiro produto" e sem os ícones de editar/excluir.
5. Configurações › WhatsApp: **sem QR e sem botão de desconectar**.
6. **Metade da prova de sharing sai de graça aqui**: na aba de atividades
   de um negócio, o menu Sequências **não** pode listar a sequência
   `teste` — ela é "Só eu" do João, e ele a vê (conferido).

Só então os itens que escrevem, **perguntando item a item**. Duas com
cuidado explícito: enviar mensagem em `/conversas` manda WhatsApp de
verdade para alguém; e perder/excluir negócio destrói o gabarito (é a
ausência de Ganho/Perdido que faz Ganhos R$ 0) — deixe por último ou use
um negócio descartável criado na hora.

No fim, **devolva a sessão logada como João** — a extensão usa o perfil
real do usuário.

Gabarito no banco (produção, 2026-08-28): 4 negócios abertos, R$ 10.650
no total — Ana 2 / R$ 5.500, João 2 / R$ 5.150. Zero Ganho, zero
Perdido. Placar: 2 linhas para os dois papéis.

**Duas armadilhas que já custaram tempo.** (1) O token da extensão
Playwright muda quando ela reinicia, e o sintoma não é erro claro: toda
chamada volta para a página `Welcome` com uma porta de relay nova, e
`browser_tabs list` mostra só essa aba. Parece aba fechada; é token
vencido. Peça o token novo, grave em `~/.claude.json` (em
`mcpServers.playwright-ext.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN`, **fora do
repo**) e reinicie a sessão. (2) Dirigir o navegador é **caro** — a
passada do João custou ~US$ 60 em snapshots de acessibilidade. Se eu
disser que quero baratear, me entregue o checklist enxuto com o número
esperado ao lado de cada item e eu percorro.

## Estado (confira antes de confiar)

- Branch `feat/multiusuario-individualizacao` e `main` estão **ambas em
  `f490abe`**, e as duas estão pushadas. Working tree limpo. O merge foi
  fast-forward, sem merge commit.
- **Produção roda esse código**, desde o deploy
  `dpl_F13adERAdhLyfbwymq3ijUdBvMcN` (`readyState: READY`, target
  production, aliased em `trino-crm.vercel.app` e
  `api-crm.aimaze.com.br`). Só foi feito smoke check: os dois domínios
  respondem 200. **Isso não prova nenhuma tela.**
- As 5 migrations do P4 estão aplicadas: `20260828100400` (sharing de
  sequências), `100500` (RLS de escrita em sequence_enrollments),
  `100600` (deal_history.actor_user_id), `100700`
  (sync_my_member_identity valida nome), `100800` (documental, no-op
  provado).
- **A sequência `teste` virou "Só eu" do João** no backfill, respeitando
  a tag `sharing:ONLY_ME` que estava gravada. A Ana não a vê. Se isso
  atrapalhar a verificação, o conserto é abrir Sequências como João e
  marcar "Todo o workspace".
- **Entradas de `deal_history` criadas antes do deploy ficam sem autor
  para sempre** — a coluna existia mas o código no ar não gravava. Só
  ações novas mostram `data · autor`.
- `origin/prod` e `origin/dev` estão no mesmo commit `01e50e1`, de
  2026-08-21, **96 commits atrás da `main`** e sem nada exclusivo. Estão
  paradas e não participam do fluxo. O projeto Vercel **não está ligado a
  repositório Git**: deploy é manual (`vercel deploy --prod`), `git push`
  não deploya nada.
- Projeto Supabase `etdkzpiehoivrviylemd`. Ids: João Reis (admin)
  `5e0c7833-819c-4f39-8864-12ab0fb17093`; joao@pixeo.com.br (admin)
  `29a555c8-dad7-4d77-ab5e-cc2f59ba8261`; Ana Clara (vendedor)
  `0c68aa6d-be0c-468d-9a7d-fed10ace1887`.

## Se aparecer bug

Corrija na mesma branch, com o padrão dos P anteriores: prova ao vivo
antes e depois, comentário explicando o porquê (não o quê), registro no
documento. **Não deploye de novo sem me perguntar.**

E saiba disto antes de sugerir rollback: **promover o deploy anterior no
Vercel não é mais uma saída limpa.** As migrations não voltam, e o código
antigo insere em `sequences` sem `owner_id`, que agora é NOT NULL com
policy exigindo `owner_id = auth.uid()` — criar sequência voltaria a dar
`42501`. Se precisar recuar, a saída é uma migration que afrouxa a
policy, não o botão do Vercel.

## Restrições que continuam valendo

- **NÃO existe framework de teste no repositório. Não instale um.**
  Verificação = asserção SQL em transação com rollback, `npx tsc
  --noEmit`, `npm run build`.
- Migration vai direto para produção (org no plano gratuito, sem branch
  de banco). **Rode a varredura em `pg_policy` ANTES de escrever
  migration** — no P2 as oito tabelas já estavam cobertas e a migration
  teria sido inútil.
- Ao provar algo como a Ana: `set local role authenticated` +
  `request.jwt.claims`, sqlstate literal. Recusa de update/delete pela
  RLS volta "0 linhas", não `42501` — garanta que existe linha para
  recusar, senão a prova é vazia. Para temp table de prova, `grant all on
  table <t> to authenticated`, senão o `set local role` derruba o insert
  com `42501 permission denied`.
- Comentários e mensagem de commit em PT-BR.
- Commite na branch `feat/multiusuario-individualizacao`. **Não faça push
  nem merge sem me perguntar.**

---

# Adendo — 2026-08-28, tarde: preparo para dirigir o navegador

Sessão gasta inteira em infraestrutura de verificação. **Nenhuma tela foi
percorrida ainda; nenhum código foi tocado.** O que mudou:

## Decisão de condução

Perguntado, o usuário escolheu **eu dirijo o navegador** (não o checklist para
ele percorrer). Depois escolheu dirigir o **Chrome real dele**, via extensão,
em vez de um Chromium próprio em script.

## O que quebrou e como ficou

- O MCP `playwright` do plugin ECC está pinado em `@playwright/mcp@0.0.69` e
  roda com `--extension`, ou seja, **só funciona com a extensão de navegador
  instalada** — sem ela, toda chamada volta `Extension connection timeout`.
- A extensão **não vem no npm nem nas releases** do `microsoft/playwright-mcp`;
  o README de lá aponta para um `packages/extension` que **não existe mais**
  naquele repo (404). Migrou para `microsoft/playwright`, e de lá sai o link
  oficial da Chrome Web Store: extensão chamada **"Playwright Extension"**,
  `mmlmfjhmonkocbjadbfplnigmagldckm`. Instalada pelo usuário.
- Com a extensão nova + servidor velho, o handshake recusa:
  *"The client uses an unsupported protocol version. Update Playwright MCP or
  CLI to the latest version."*
- **Correção aplicada:** servidor MCP novo em escopo de usuário, chamado
  `playwright-ext`, apontando para `@playwright/mcp@latest` (hoje `0.0.79`, já
  baixado no cache do `npx`), com o token da extensão em variável de ambiente.
  Gravado em `~/.claude.json` — **o token não entra no repo, não repita ele
  aqui.** O servidor `playwright` velho do ECC continua existindo e continua
  falhando; use o `playwright-ext`.
- Servidor MCP novo só entra em vigor **reiniciando a sessão** — foi por isso
  que esta sessão acabou aqui.

## Ao retomar

1. Peça uma aba aberta em `https://trino-crm.vercel.app` e aprove a conexão da
   extensão quando ela pedir (a primeira chamada abre a página de seleção de
   aba).
2. **Peça as senhas ao usuário** — as duas contas entram por
   `signInWithPassword` (`src/app/login/page.tsx`); o Google OAuth do mesmo
   formulário não é dirigível. Senha nenhuma fica registrada neste repo.
   Emails: João `joaoreiscefet@gmail.com`, Ana `claraferrodrigui@gmail.com`
   (confirmados em `auth.users`; o prompt original trazia o da Ana com typo).
3. A extensão usa o **perfil real** do usuário: a passada da Ana exige deslogar
   o João pela UI, e no fim devolva a sessão logada como João.

## Gabarito reconferido no banco hoje

`deals` do workspace, não deletados: **4 abertos, R$ 10.650** — Ana **2 /
R$ 5.500**, João **2 / R$ 5.150**, todos `Ativo`. Zero `Ganho`, zero `Perdido`,
o que sustenta Ganhos **R$ 0** e conversão **0%** em qualquer período.

## Ordem acordada da verificação

Leitura pura primeiro, com o banco intacto — é o que fecha os cruzamentos
numéricos antes de qualquer escrita:

1. **João:** Painel (período existe; "Todos os vendedores" = R$ 10.650 / 4;
   Ganhos R$ 0; conversão 0%; placar 2 linhas) → filtra Ana (R$ 5.500 / 2) →
   troca período (Pipeline e "Atividades Hoje" **não** mudam; placar muda) →
   placar **não** muda ao trocar vendedor.
2. **João:** `/negocios` filtrado por vendedor — cabeçalho, cards, totais por
   etapa e contagens do dropdown têm que dar **o mesmo número**; `/conversas`
   (dropdown com os dois nomes); Insights (placar).
3. **Ana:** Painel R$ 5.500 / 2 (o cruzamento que pega o defeito do P1), sem
   seletor de vendedor, placar com 2 pessoas; `/automacoes` e as seis URLs de
   Configurações do P2 fora do menu e com "Sem acesso"; Produtos abre sem os
   botões de escrita; WhatsApp sem QR nem desconectar.
4. Só então os itens que escrevem.

## Autorização de escrita — ainda não dada

Doze ações do roteiro gravam em produção (criar contato, reatribuir negócio,
aplicar sequência, mudar sharing, enviar WhatsApp, assumir conversa da fila,
importar CSV, meta + atividade concluída, anexo em atividade órfã, vencer
atividade, perder/excluir negócio com motivo, nome vazio no Perfil). **Pergunte
item a item antes da primeira.** Duas merecem cuidado explícito:

- **Enviar mensagem no `/conversas`** manda WhatsApp de verdade para alguém —
  sugerido negar, ou usar um número seguro combinado.
- **Perder/excluir negócio com motivo** destrói o gabarito: é justamente a
  ausência de Ganho/Perdido que faz Ganhos R$ 0. Deixe por último, ou faça num
  negócio descartável criado na hora.

## Correção ao "Estado" acima

"As duas estão pushadas" vale para `f490abe`. O commit de doc `7056d18` está
**só local** — a branch está `ahead 1` de `origin/feat/multiusuario-individualizacao`.
Este adendo é mais um commit local em cima dele.

---

# Adendo 2 — 2026-08-28, noite: passada do João executada no navegador

Primeira vez que alguma tela desta branch foi clicada de verdade. Conduzido
pelo agente via MCP `playwright-ext` no Chrome do usuário.

## Verificado como João (admin), tudo leitura pura, banco intacto

Todos os itens abaixo passaram, com o número visto batendo com o gabarito SQL:

| Item | Esperado | Visto |
|---|---|---|
| Painel: seletor de período | 6 opções iguais às de Insights | Este mês / Mês passado / Este ano / Últimos 7 dias / Últimos 30 dias / Todo o período |
| Painel, "Todos os vendedores" | R$ 10.650 / 4 abertos | R$ 10.650,00 / 4 |
| Ganhos e conversão | R$ 0 e 0% | R$ 0,00 · "dos fechados no período" · 0% |
| Painel filtrando a Ana | R$ 5.500 / 2 | R$ 5.500,00 / 2 |
| Troca de período | Pipeline e "Atividades Hoje" não mudam | 10.650/4 e 1 pendente, idênticos |
| Placar × período | muda | João 34 ativ./35 lig. → 0/0 em "Mês passado" |
| Placar × filtro de vendedor | não muda | idêntico |
| `/negocios` filtrado (o bug do P1) | 4 pontos com o mesmo número | cabeçalho "2 negócios · R$ 5.500", etapa Reunião Realizada R$ 5.500, dropdown de pipeline "Negociação 2 · R$ 5.500", "Prospeccao 0 · R$ 0" |
| `/conversas`, aba Time | dropdown com os dois nomes | Todos os vendedores / Ana Clara / Joao Reis |
| Balão da conversa | autor certo | "Ana Clara" + corpo `*Ana Clara*: Oi bruna tudo bem?` |
| Filtro de `/atividades` | encolhe a lista | 1 atividade → 0 filtrando João |
| Insights | placar aparece | 2 linhas + seletor "Todos os usuarios" |
| Sequência `teste` para o dono | visível | aparece no menu Sequências da aba de atividades |
| Histórico do negócio | linha antiga só com data | "28/08/2026 10:28", sem autor — como previsto |

O total geral fecha: os R$ 10.650 se dividem em R$ 7.150 no pipeline
"Negociação" (3 negócios) e R$ 3.500 no "Prospeccao" (1), e `/negocios` mostra
um pipeline por vez.

## Achados novos, nenhum bloqueia o P5

1. **Prefetch de `/dashboard` volta 404.** `/dashboard` é rewrite para `/`
   (`next.config.ts:81`), e o payload RSC (`/dashboard?_rsc=…`) não é servido
   pelo rewrite. Aparece no console de **toda** página que renderiza o menu,
   porque o link "Meu Painel" aponta para `/dashboard`. Navegação funciona
   (conferido por clique e por load direto); perde-se só o prefetch.
2. **Rótulos sem acento em `/insights`**: "Este mes", "Todos os usuarios",
   "0 relatorios", "Criar relatorios padrao". Em `/` os mesmos rótulos têm
   acento. Cosmético e anterior ao P3 — o P3 exigia a *chave* sem acento
   (contrato de `periodToRange`), não o rótulo.
3. **Não existe nenhuma meta criada em produção** ("Nenhuma meta criada").
   O item do P4 — meta de "Atividades" com progresso > 0 — só é verificável
   criando uma meta, ou seja, virou item de escrita.

## Falta

- **Toda a passada da Ana** (item 3 da ordem): Painel R$ 5.500 / 2 sem seletor
  de vendedor mas com placar; `/automacoes` e as seis URLs do P2 fora do menu e
  com "Sem acesso"; Produtos abre sem botões de escrita; WhatsApp sem QR.
  **Metade da prova de sharing é leitura pura**: a Ana **não** pode ver a
  sequência `teste`.
- Os doze itens de escrita, ainda sem autorização.

## Armadilha da infraestrutura, para não perder tempo de novo

**O token da extensão Playwright muda quando a extensão reinicia.** Com o token
velho no servidor MCP, o sintoma não é um erro claro: toda chamada volta para a
página `Welcome` da extensão, com uma porta de relay nova a cada vez
(59285 → 59293 → 59300), e `browser_tabs list` mostra só essa aba. Parece aba
fechada; é token vencido. O token fica em `~/.claude.json`, em
`mcpServers.playwright-ext.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN` — **fora do
repo, e não deve ser copiado para cá.** Trocar o token exige **reiniciar a
sessão** para o servidor MCP relê-lo.

Outras duas, menores: o menu suspenso intercepta o clique seguinte (feche-o
clicando no próprio botão — `Escape` não fecha), e o logout pela UI derruba a
aba conectada à extensão.
