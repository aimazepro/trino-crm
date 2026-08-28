# Prompt para a próxima sessão (P5)

Copie o bloco abaixo inteiro como primeira mensagem da sessão nova.

> Atualizado em 2026-08-28, **depois** do push, do merge na `main` e do deploy
> em produção. A versão anterior deste arquivo dizia que produção não tinha os
> commits — não é mais verdade.

---

P5 do docs/TODO-2026-08-28-multiusuario-pendencias.md. Leia o documento
inteiro antes de mexer em qualquer coisa — P0 a P4 estão fechados e cada
seção registra premissas que se mostraram erradas. Três delas mudam como
você trabalha: a do P2 muda como se prova um gate, a do P3 registra que
o painel não tinha período nenhum, e a do P4 corrige duas descrições de
sintoma que estavam erradas no próprio documento.

**O P5 encolheu.** Ele tinha duas partes: verificar as telas, e depois
deployar e mergear. **A segunda parte já foi feita** — merge na `main` e
deploy em produção, nesta ordem invertida, por decisão minha e com o
risco declarado. Sobra só a verificação, que é o que nunca aconteceu:
nada foi clicado em navegador nesta branch inteira. Tudo foi provado por
leitura de código e asserção SQL.

**Não é para codar.** Comece me perguntando como quero conduzir: eu
percorro as telas e te reporto, ou você tenta dirigir o navegador. Se for
eu, sua saída é um checklist enxuto, na ordem das telas, com o número
esperado ao lado de cada item — não um passo a passo prolixo. O roteiro
completo está no P5 do documento, já com os itens do P3 e do P4
acrescentados.

Números provados no banco, que servem de gabarito (produção,
2026-08-28):
- Admin, "Todos os vendedores": Pipeline R$ 10.650, 4 abertos.
- Admin filtrando a Ana: R$ 5.500, 2 abertos — tem que bater com o que a
  Ana vê logada. É esse cruzamento que pega o bug que o P1 corrigiu.
- Ganhos R$ 0 e conversão 0% em qualquer período: não existe negócio
  Ganho nem Perdido em produção.
- Placar do time: 2 linhas para os dois papéis.

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
