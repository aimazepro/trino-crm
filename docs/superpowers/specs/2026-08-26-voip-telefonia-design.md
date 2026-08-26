# VoIP / Telefonia nativa no TrinoCRM — Design

**Data:** 2026-08-26
**Fase do backlog:** 4b — VoIP (`docs/BACKLOG.md`)
**Checkpoint de rollback:** tag `pre-voip` (`b7428ae`)

## Problema

`/configuracoes/telefone` e `/ligacoes` existem mas são 100% decorativos:

- `src/app/configuracoes/telefone/page.tsx` — `useState("disconnected")`, "Ramal 1070"
  hardcoded, botão que só troca estado local. Sem tabela, sem rota, sem provedor.
- `src/app/ligacoes/page.tsx` — 31KB de gráficos plotando `SAMPLE_CALLS`
  hardcoded com `recordingUrl: "sample.mp3"`.

O dono quer telefonia real: vendedor liga de dentro do CRM com um clique, a
chamada é gravada, registrada no negócio, e o minuto é cobrado do cliente do
CRM com margem.

## Decisões tomadas (com o dono, 2026-08-26)

| Decisão | Escolha | Motivo |
|---|---|---|
| Arquitetura | Adapter provider-agnóstico, tudo no Next.js | Espelha o padrão WhatsApp/Evolution já em produção |
| Provedor | Brasileiro licenciado, plugado depois via env var | Regulatório + bina dinâmica + BRL. Ver `docs/2026-08-26-voip-provedores-memo.md` |
| Modo de fala | Webphone WebRTC no navegador | Custo menor, CRM controla a chamada |
| Escopo V1 | Completo: ramais, saldo, tarifação, gravação+LGPD, `/ligacoes` real, disposição | Pedido explícito: "nada decorativo" |
| PBX próprio | **Não** | Sem alguém dedicado a telefonia, ICE/NAT/codec come semanas |

### Por que adapter, e não integrar direto

Não é over-engineering. É poder de barganha e rota de fuga:

1. Nenhum contrato está fechado. O adapter permite construir e testar o sistema
   inteiro **hoje**, contra um provider `mock`, sem depender de ninguém.
2. Trocar de provedor no futuro custa um arquivo, não uma reescrita. Quando o
   provedor souber disso, o preço por minuto melhora.
3. Migração pode ser feita workspace a workspace (coluna `provider` por conta),
   nunca big bang.

## Arquitetura

```
Navegador                    Next.js (Vercel)                 Provedor
─────────                    ────────────────                 ────────
<Softphone>  ──token──▶  /api/telephony/token   ──────────▶  emite JWT efêmero
     │                          │
     │                   valida ramal + saldo
     │
  [Ligar]    ──────────▶  /api/telephony/calls  ──adapter──▶  originateCall()
     │                          │                                  │
     │                   cria telephony_calls                      │
     │                   reserva saldo                             │
     ◀── ramal toca (SIP/WebRTC) ───────────────────────────────────┘
     │
     └── conversa ──────────────────────────────────────────▶ disca destino
                                │
                          eventos de chamada
                                ▼
                    /api/telephony/webhook  ◀────────────  ringing/answered/
                                │                           completed/recording
                    verifica assinatura
                    normaliza evento
                                ▼
                    RPC telephony_finalize_call()  ← transação única:
                      · atualiza CDR
                      · debita ledger (idempotente)
                      · libera reserva
                      · cria atividade na timeline
```

### Princípio central: a verdade é o CDR do provedor

O timer do navegador **nunca** cobra. Aba fechada, wifi caindo, relógio do
cliente errado — tudo isso produz cobrança errada, que é o pior tipo de bug
porque o cliente descobre antes de você. A duração faturável vem do evento
`completed` do provedor, e o débito acontece numa RPC transacional com chave de
idempotência derivada do ID da chamada no provedor. Webhook reentregue não
cobra duas vezes.

## Originação server-side (decisão não-óbvia)

Mesmo com webphone no navegador, quem origina a chamada é o **servidor**, não o
SDK do browser.

O servidor pede ao provedor: "ligue para o ramal 2017 e, quando atender, disque
para o lead". O webphone só precisa estar registrado para receber a perna.

Ganhos:
- `provider_call_id` disponível imediatamente → matching CRM↔chamada trivial
  (sem gambiarra de header SIP customizado ecoado no webhook)
- Saldo verificado **antes** de gastar
- O mesmo caminho serve para o modo `callback` (muda só o `from`), então o
  escape hatch para vendedor de rua não exige refazer nada
- Aba fechada no meio não deixa chamada órfã sem registro

## Schema

Prefixo `telephony_`. Convenções de RLS e grants seguem
`supabase/migrations/20260819120000_whatsapp_evolution.sql`.

### `telephony_accounts` — uma por workspace
Credenciais do provedor. Tabela trancada (RLS on, zero policies, acesso só via
service role), igual `whatsapp_connections`.

- `workspace_id` unique, `provider` ('mock'|'api4com'|'telnyx'|…)
- `provider_account_id`, `credentials_encrypted` (via `src/lib/token-crypto.ts`)
- `status` ('inactive'|'provisioning'|'active'|'suspended')
- `caller_id`, `webhook_secret`
- `recording_enabled`, `recording_retention_days`, `consent_mode`, `consent_text`
- `bill_increment_seconds` (default 60), `minimum_billable_seconds`

### `telephony_extensions` — um ramal por usuário
- `workspace_id`, `user_id`, `extension` ('2017')
- `provider_credential_id`, `sip_username`, `sip_password_encrypted`
- `mode` ('unlimited'|'per_minute') — Ilimitado ocupa vaga do plano; Por minuto
  desconta do saldo
- `dial_mode` ('webphone'|'callback') — webphone implementado no V1, callback é
  o escape hatch já previsto no schema
- `callback_number`, `status`, `linked_by`, `linked_at`
- unique `(workspace_id, user_id)` e `(workspace_id, extension)`

### `telephony_calls` — o CDR
- vínculo CRM: `contact_id`, `deal_id`
- `direction`, `from_number`, `to_number`
- `provider`, `provider_call_id` — unique `(provider, provider_call_id)`
- `status` ('queued'|'ringing'|'answered'|'completed'|'failed'|'no_answer'|'busy'|'canceled')
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`
- `billed_cents`, `rate_cents_per_minute` (tarifa **congelada** no momento da
  chamada — mudar preço não pode reescrever histórico)
- `recording_status`, `recording_key`, `recording_expires_at`, `consent_given`
- `disposition`, `notes`, `hangup_cause`

### `telephony_ledger` — append-only, a fonte da verdade do dinheiro
- `kind` ('credit_purchase'|'call_debit'|'adjustment'|'refund')
- `amount_cents` (assinado), `balance_after_cents`
- `call_id`, `description`, `created_by`
- **`idempotency_key` UNIQUE** — `call_debit:<provider_call_id>`. É esta
  constraint que impede cobrança dupla, não a lógica da aplicação.

### `telephony_balances` — contador materializado
- `workspace_id` pk, `balance_cents`, `reserved_cents`
- Existe para checagem atômica na hora de discar. O ledger continua sendo a
  verdade; este contador é derivável e reconciliável.

### `telephony_events` — log cru de webhook
- `provider_event_id` unique, `payload` jsonb, `processed_at`, `error`
- Serve para depurar eventos fora de ordem e reprocessar sem risco.

### `telephony_rates` — tarifa
- `workspace_id` (null = padrão global), `destination_type`
  ('mobile'|'landline'|'tollfree'|'international'), `cost_cents_per_minute`
  (o que você paga), `price_cents_per_minute` (o que você cobra),
  `effective_from`
- Guardar custo **e** preço separados é o que torna a margem mensurável por
  workspace em vez de um chute.

## Camada de adapter

`src/lib/telephony/`

```ts
export interface TelephonyProvider {
  readonly name: string;
  provisionAccount(i: ProvisionInput): Promise<ProvisionResult>;
  createExtension(i: CreateExtensionInput): Promise<ExtensionResult>;
  deleteExtension(i: { credentialId: string }): Promise<void>;
  issueWebphoneToken(i: { extension: Extension }): Promise<WebphoneToken>;
  originateCall(i: OriginateInput): Promise<{ providerCallId: string }>;
  hangupCall(i: { providerCallId: string }): Promise<void>;
  fetchRecording(i: { providerCallId: string }): Promise<RecordingRef | null>;
  verifyWebhook(req: Request, secret: string): Promise<boolean>;
  parseWebhook(body: unknown): NormalizedCallEvent[];
}
```

Todo evento de provedor é normalizado para:

```ts
type CallEventType =
  | "initiated" | "ringing" | "answered"
  | "completed" | "failed" | "recording_ready";

interface NormalizedCallEvent {
  providerEventId: string;
  providerCallId: string;
  type: CallEventType;
  occurredAt: string;
  durationSeconds?: number;  // só em completed — autoritativo
  hangupCause?: string;
  recordingRef?: string;
  raw: unknown;
}
```

Implementações no V1:
- **`mock`** — simula o ciclo completo (ringing → answered → hangup) com duração
  configurável e um áudio de teste, disparando os mesmos webhooks assinados.
  É o que torna saldo, débito, timeline, disposição e `/ligacoes` testáveis
  ponta a ponta **sem contrato com ninguém**.
- **`api4com`** — escrito contra a doc pública (`developers.api4com.com`),
  ativado por env var quando a conta existir.

### Armazenamento de gravação

Interface `RecordingStore` com duas implementações:
- `provider` (padrão) — o áudio fica no provedor, servido por proxy assinado
- `supabase` — bucket privado

Em escala a resposta certa é Cloudflare R2 (egress zero) com regra de ciclo de
vida casada com a retenção LGPD. A interface existe para que isso seja um
arquivo novo, não uma migração de dados às pressas.

## Rotas

| Rota | Método | O quê |
|---|---|---|
| `/api/telephony/account` | GET/POST | Ler/provisionar conta do workspace |
| `/api/telephony/extensions` | GET | Listar ramais do time |
| `/api/telephony/extensions` | POST | Vincular ramal (só dono) |
| `/api/telephony/extensions/[id]` | DELETE/PATCH | Desvincular / trocar modo |
| `/api/telephony/token` | POST | Token efêmero do webphone |
| `/api/telephony/calls` | POST | Originar chamada |
| `/api/telephony/calls` | GET | Listar CDR (alimenta `/ligacoes`) |
| `/api/telephony/calls/[id]` | PATCH | Disposição + notas |
| `/api/telephony/calls/[id]/recording` | GET | Proxy assinado do áudio |
| `/api/telephony/webhook/[provider]` | POST | Eventos do provedor |
| `/api/telephony/credits` | POST | Lançar crédito (dono) |
| `/api/telephony/balance` | GET | Saldo + extrato |

## Segurança

- Webhook com verificação de assinatura por conta (`webhook_secret`), comparação
  timing-safe. Segue `src/lib/webhook-security.ts`.
- Credenciais SIP nunca persistem no navegador. O webphone recebe token efêmero.
- Rate limit na rota de originação — é rota que **gasta dinheiro do cliente**.
  O backlog aponta zero rate limiting no projeto (Fase 5); aqui não dá pra
  deixar pra depois.
- Validação de entrada com zod nas rotas novas (número de destino, modo, valores
  monetários).
- Todas as tabelas com `workspace_id`, nunca `user_id`, como escopo de tenant —
  o rename `user_id → workspace_id` já causou 6 incidentes neste repo.

## LGPD

- **Consentimento:** `consent_mode` ('announce'|'manual'|'off') + `consent_text`
  configurável. Cada chamada registra `consent_given`.
- **Retenção:** `recording_retention_days` por conta, com job **diário** de
  expurgo. Cron diário é obrigatório: cron não-diário quebra o deploy inteiro no
  Vercel Hobby, silenciosamente.
- **Acesso:** áudio só por URL assinada de vida curta via proxy autenticado.
  Nunca bucket público, nunca link direto do provedor no HTML.
- **Exclusão:** endpoint para apagar gravações de um contato (direito do
  titular).


## Script de ligação na tela (pedido do dono, 2026-08-26)

Ao disparar a chamada a partir do card de ligação do negócio, abre um diálogo que
acompanha a chamada e mostra:

- O **script de cold call** daquele usuário/etapa, vindo de
  `/configuracoes/scripts-ligacao` (o catálogo já existe no produto)
- Timer da chamada ao vivo e controles (mudo, desligar)
- Campo de notas que grava direto na chamada
- Botões de disposição no encerramento (atendeu / não atendeu / caixa postal /
  reagendar / sem interesse), que viram atividade na timeline

O diálogo é o mesmo componente para os dois pontos de entrada: card de ligação do
negócio e detalhe do contato.

## Testes

- RPC de finalização: débito duplo com o mesmo `provider_call_id` deve resultar
  em **um** lançamento no ledger.
- Evento fora de ordem (`completed` antes de `answered`) não corrompe o CDR.
- Saldo insuficiente bloqueia a originação antes de gastar.
- Modo `unlimited` não debita.
- Tarifa congelada: mudar `telephony_rates` não altera `billed_cents` de
  chamadas passadas.
- Chamada sem webhook final (provedor caiu) é reconciliada pelo job diário.

## Fora de escopo no V1

- Checkout de créditos com gateway de pagamento (lançamento manual pelo dono no
  V1, até o gateway do `/configuracoes/billing` estar definido)
- Chamadas recebidas (inbound) com IVR/fila
- Discador preditivo
- Transferência e conferência
- Modo `callback` (schema já prevê, implementação depois)
