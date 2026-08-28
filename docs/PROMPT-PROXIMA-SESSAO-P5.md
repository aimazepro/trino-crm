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
