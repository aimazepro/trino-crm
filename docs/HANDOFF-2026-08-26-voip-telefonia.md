# Handoff — Telefonia / VoIP (Fase 4b)

**Data:** 2026-08-26 · **Estado:** em produção · **Rollback:** `git reset --hard pre-voip` (`b7428ae`)

Sessão anterior custou US$ 835. A maior parte disso foi reler histórico, não
escrever código — por isso este handoff existe: retomar daqui deve ser barato.

---

## O que existe hoje

`/configuracoes/telefone` e `/ligacoes` eram 100% decorativos (`useState` local,
`SAMPLE_CALLS` hardcoded). Agora são reais, ponta a ponta, em produção em
`api-crm.aimaze.com.br`.

### Arquitetura — dois adapters, nenhuma dependência dura

**Operadora** (`src/lib/telephony/`): nenhuma rota fala com um provedor
específico, todas falam com a interface `TelephonyProvider`.
- `mock` — emite os mesmos webhooks assinados que uma operadora real emitiria,
  no mesmo endpoint, com a mesma verificação de assinatura. Não é atalho: é o
  que torna o sistema exercitável sem contrato.
- `api4com` — escrito contra a doc pública, **não verificado contra conta real**.
  O arquivo lista no topo os 5 pontos a confirmar quando a conta existir.

**IA de análise** (`src/lib/telephony/analysis/`): `CALL_ANALYSIS_PROVIDER`
escolhe entre `gemini` (ativo) e `claude`. Prompt e schema são compartilhados,
então trocar de IA não muda o formato salvo no banco.

### Banco

7 tabelas `telephony_*` + 7 RPCs. Migrations:
`20260826180000_telephony_voip.sql`, `20260826180100_telephony_rpcs.sql`,
`20260826200000_telephony_transcript_analysis.sql`.

**A regra do dinheiro:** a duração faturável vem sempre do CDR da operadora,
nunca do cronômetro do navegador. O débito mora em `telephony_finalize_call`,
numa transação. Quem impede cobrança dupla é a constraint UNIQUE em
`telephony_ledger.idempotency_key` — não a lógica da aplicação.

### Verificado de verdade

- 10 testes de dinheiro no banco (90s → R$ 0,76; webhook reentregue não cobra de
  novo; não atendida não cobra; ilimitado não debita; saldo insuficiente bloqueia)
- 4 testes por HTTP contra produção, incluindo assinatura forjada → 401
- Análise: schema aninhado testado contra a API real do Gemini, saída válida

### NÃO verificado

Tudo que é de navegador: player, gravação, mudo, teclado DTMF, transcrição,
diálogo de ligação. Passou typecheck, lint e build; ninguém clicou.

---

## Configuração em produção

| Variável | Valor |
|---|---|
| `CALL_ANALYSIS_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | configurada |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `CRON_SECRET`, `OAUTH_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | já existiam |

`TELEPHONY_PROVIDER` não está setada — o código cai em `mock`, que é o desejado
até haver contrato.

> **Pendência de segurança:** a `GEMINI_API_KEY` foi colada no chat da sessão
> anterior. Rotacionar no AI Studio quando conveniente.

---

## Armadilhas que já custaram tempo — não repetir

1. **Rota chamada por máquina precisa entrar no matcher de `src/proxy.ts`.**
   Sem isso o chamador recebe 307, lê como sucesso e nunca reenvia. Falha
   silenciosa, nada em log. Já aconteceu 3× neste repo (WhatsApp, cron,
   telefonia).
2. **Safari só toca `<audio>` com resposta 206 + `Content-Range`.** Com 200
   simples ele baixa, não reproduz e não acusa erro. Foi o bug de "a gravação
   não toca".
3. **Cron não-diário quebra o deploy inteiro no Vercel Hobby**, silenciosamente.
   O de telefonia é diário (`0 4 * * *`) e por isso passa.
4. **`workspaces.id === owner_user_id`** neste schema. Dono não é papel de
   `workspace_members` — papéis são `admin`, `gerente`, `vendedor`.
5. **Interface TS não satisfaz `Record<string, unknown>`** — o cliente Supabase
   tipado exige `type`, não `interface`, ou tudo vira `never`.
6. **`.select()` com concatenação de string** apaga a inferência do PostgREST.
   Literal único.
7. **Nome de modelo do Gemini expira.** `gemini-2.5-flash` respondeu 404
   mandando usar outro. Por isso `GEMINI_MODEL` é env, e o adapter tem retry
   para o 503 de sobrecarga, que aconteceu na primeira chamada real.

---

## O que falta — decisão de negócio, não código

1. **Contratar a operadora.** Memo completo em
   `docs/2026-08-26-voip-provedores-memo.md`: 12 operadoras, fontes citadas,
   perguntas para o comercial. Ranking para revenda: **Zenvia Voice > Telnyx >
   API4Com**.

   **O achado que muda a conta: R$ 0,38/min é o preço de balcão histórico da
   própria API4Com.** Revender nesse valor dá margem ~zero — é o preço que o
   cliente consegue sozinho. Ou negocia atacado para vender a R$ 0,25–0,29, ou
   mantém R$ 0,38 e empacota gravação/transcrição/análise.

   O plano por vaga da API4Com (R$ 199,90/usuário) só empata se a pessoa discar
   ~526 min/mês. Abaixo disso você paga fixo e cobra variável.

2. **Checkout de crédito.** Hoje o dono lança manualmente. A RPC já é
   idempotente, então o gateway pluga sem mexer em mais nada. O bloqueio real é
   que `/configuracoes/billing` ainda é mockado.

3. **Bina dinâmica por DDD.** Comprar DID por região e monitorar bloqueio por
   spam é trabalho semanal, para sempre. É o que decide taxa de atendimento.

4. **API4Com guarda gravação?** A doc pública não documenta endpoint de
   gravação, webhook com URL do áudio nem retenção. Pergunta para o comercial.
   Se guardarem, `fetchRecording` do adapter já cobre e a gravação pelo
   navegador vira só o caminho do simulado.

5. **Fora do escopo do V1:** inbound com IVR, discador preditivo, transferência,
   conferência, modo callback (o schema já prevê o campo).

---

## Como testar em 5 minutos

1. Configurações → Telefone → **Ativar telefonia** (Simulado)
2. Ramais do time → **Vincular ramal** no seu nome → *Por minuto*
   (Ilimitado aparece bloqueado de propósito: o workspace está em trial)
3. **R$ 25,00** de crédito no card de saldo
4. Abrir negócio com contato que tenha telefone → aba **Ligações**
5. **Ligar** → escolher script (busca funciona, variáveis vêm preenchidas) →
   falar → **Encerrar** → classificar → salvar
6. Conferir: lista da aba, timeline do negócio, saldo descontado, player tocando,
   análise gerada sozinha
