# Prompt para a próxima sessão (P5)

Copie o bloco abaixo inteiro como primeira mensagem da sessão nova.

---

P5 do docs/TODO-2026-08-28-multiusuario-pendencias.md. Leia o documento
inteiro antes de mexer em qualquer coisa — P0 a P4 estão fechados e cada
seção registra premissas que se mostraram erradas. Três delas mudam como
você trabalha: a do P2 muda como se prova um gate, a do P3 registra que
o painel não tinha período nenhum, e a do P4 corrige duas descrições de
sintoma que estavam erradas no próprio documento.

O P5 é diferente dos anteriores: **não é para codar**. É verificação em
navegador e depois integração. Nada foi clicado em navegador nesta branch
inteira — tudo foi provado por leitura de código e asserção SQL. O
roteiro está no P5 do documento, já com os itens do P3 e do P4
acrescentados.

Comece me perguntando como quero conduzir a verificação: eu percorro as
telas e te reporto, ou você tenta dirigir o navegador. Se for eu, sua
saída é um checklist enxuto, na ordem das telas, com o número esperado ao
lado de cada item — não um passo a passo prolixo.

Números que já estão provados no banco e servem de gabarito (produção,
2026-08-28):
- Admin, "Todos os vendedores": Pipeline R$ 10.650, 4 abertos.
- Admin filtrando a Ana: R$ 5.500, 2 abertos — tem que bater com o que a
  Ana vê logada. É esse cruzamento que pega o bug que o P1 corrigiu.
- Ganhos R$ 0 e conversão 0% em qualquer período: não existe negócio
  Ganho nem Perdido em produção.
- Placar do time: 2 linhas para os dois papéis.

Depois da verificação vêm deploy e merge, e os dois exigem minha
autorização explícita — **não deploye, não mergeie e não faça push sem me
perguntar**. Deploy neste projeto é manual (`vercel deploy --prod`); `git
push` não deploya. Produção roda a branch de propósito.

Contexto de estado que você precisa ter na mão:
- Branch `feat/multiusuario-individualizacao`, working tree limpo, 4
  commits à frente do origin e **não** enviados: `0028458` (P3),
  `686e5cc`, `743da66`, `20e5747` (P4).
- **Produção não tem nenhum desses 4 commits.** Mas as migrations do P4
  **já estão aplicadas no banco** — logo, banco novo rodando código
  velho. É de propósito e as migrations são aditivas, mas gera dois
  efeitos visíveis agora, antes do deploy:
  1. A sequência `teste` virou "Só eu" do João. A Ana não a vê mais na
     aba de atividades. Se isso atrapalhar a verificação, o conserto é
     abrir Sequências como João e marcar "Todo o workspace".
  2. `deal_history.actor_user_id` existe mas o código velho não grava —
     entradas criadas antes do deploy ficam sem autor para sempre.
- Migrations do P4 aplicadas: `20260828100400` (sharing de sequências),
  `100500` (RLS de escrita em sequence_enrollments), `100600`
  (deal_history.actor_user_id), `100700` (sync_my_member_identity valida
  nome), `100800` (documental, no-op provado).
- Projeto Supabase `etdkzpiehoivrviylemd`. Ids: João Reis (admin)
  `5e0c7833-819c-4f39-8864-12ab0fb17093`; joao@pixeo.com.br (admin)
  `29a555c8-dad7-4d77-ab5e-cc2f59ba8261`; Ana Clara (vendedor)
  `0c68aa6d-be0c-468d-9a7d-fed10ace1887`.

Restrições que continuam valendo:
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
- Commite na branch `feat/multiusuario-individualizacao`.

Se durante a verificação aparecer bug, corrija na mesma branch com o
mesmo padrão dos P anteriores: prova ao vivo antes e depois, comentário
explicando o porquê (não o quê), e o registro no documento.
