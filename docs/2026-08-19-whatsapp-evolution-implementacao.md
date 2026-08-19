# WhatsApp via Evolution API — implementado em 2026-08-19

Fecha a Fase 3 da auditoria (`docs/AUDIT-2026-08-19-saas-deep-dive.md`) para o
caminho 1:1: `/configuracoes/whatsapp` com QR real e `/conversas` em tempo real.

## Modelo

**Uma instância Evolution por dono de conta.** Todos os membros daquele
workspace compartilham a mesma instância e a mesma inbox. Quem foi convidado
para o workspace de outra pessoa não pode conectar nem desconectar — só o dono.

Nome da instância: `trinocrm-<local-part do email>-<8 chars do uid>`. Legível no
painel da Evolution e imune a troca de email, porque a chave é o uid.

## Tabelas (migration `20260819120000_whatsapp_evolution.sql`)

| Tabela | Papel |
|---|---|
| `whatsapp_connections` | 1 linha por dono. Guarda `instance_token` (criptografado) e `webhook_secret`. **Sem grants para `authenticated`** — só service role, via rotas. |
| `whatsapp_conversations` | 1 por `(connection_id, remote_jid)`. Liga a `contacts`/`deals` quando o telefone bate. |
| `whatsapp_messages` | Índice único `(conversation_id, wa_message_id)` = idempotência do webhook. |

RLS: `user_id = auth.uid() OR is_workspace_member(user_id)` — já preparada para
a Fase 1 de multi-tenancy sem reescrita.

Realtime: as duas últimas estão na publication `supabase_realtime`.

Mídia: bucket privado `whatsapp-media`, path
`<uid do dono>/<conversation_id>/<uuid>.<ext>`. O banco guarda `media_path`, não
URL; o navegador assina sob demanda (1 h). Trocar para R2 = reescrever
`src/lib/whatsapp/storage.ts`.

RPC `find_contact_by_phone(uuid, text)`: casa pelos últimos 8 dígitos, o que
resolve o nono dígito brasileiro sem mudar o schema de `contacts.phones`.

## Código

```
src/lib/whatsapp/
  types.ts       interface WhatsAppDriver + tipos normalizados
  evolution.ts   driver Evolution v2 (unico hoje)
  index.ts       getDriver() — ponto de troca para uazapi
  storage.ts     put/sign de midia
  connection.ts  helpers server-side (service role, criptografia, webhook URL)
  ingest.ts      evento normalizado -> linhas
src/hooks/use-whatsapp-inbox.ts   estado + Realtime da inbox
src/app/api/whatsapp/{connect,status,disconnect,send,webhook/[connectionId]}
```

Trocar para uazapi: novo arquivo implementando `WhatsAppDriver`, um `case` em
`getDriver`, e o valor de `whatsapp_connections.provider`. Nada acima muda.

## Segurança do webhook

- Rota isenta do matcher de `src/proxy.ts` (Evolution não manda cookie).
- Header `x-trinocrm-secret` comparado com `timingSafeEqual` contra o
  `webhook_secret` **daquela conexão** — segredo por workspace, não global.
- Conexão inexistente e segredo errado devolvem a mesma 401, para o endpoint não
  servir de enumerador de ids.
- Grupos filtrados duas vezes: `groupsIgnore: true` na criação da instância e de
  novo na normalização.
- Sempre 200 depois da autenticação: Evolution repete em erro, e uma tempestade
  de retry sobre um payload que não parseia é pior que registrar e seguir.

## Contratos verificados contra o servidor real (v2.3.7, 2026-08-19)

Instância descartável criada e deletada; as 3 de produção (`aimaze`,
`pixeomkt`, `sinpase`) não foram tocadas.

| Chamada | Confirmado |
|---|---|
| `POST /instance/create` | `instance.instanceId`; `hash` é string (o token); `qrcode.base64` já vem como data URL |
| `GET /instance/connect/{i}` | QR na raiz da resposta, sem envelope `qrcode` |
| `GET /instance/connectionState/{i}` | `{instance:{state}}` |
| `POST /webhook/set/{i}` | 201; `headers` customizados persistem e voltam no evento |
| `DELETE /instance/delete/{i}` | remove sem resíduo |

## Configuração

`WHATSAPP_WEBHOOK_BASE_URL` aponta para o deploy público **inclusive em dev**:
local e produção compartilham o mesmo Supabase, então o webhook cai em produção,
grava no banco, e o `/conversas` rodando em `next dev` atualiza por Realtime.
Sem túnel. `webhookUrlFor()` recusa base não-https ou de rede privada em vez de
registrar uma instância cujo webhook nunca dispararia.

Envs de produção adicionadas: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
`WHATSAPP_WEBHOOK_BASE_URL`.

## Pendências conhecidas

- **Config do stack Evolution não alterada** (é redeploy do Swarm, do dono):
  `DATABASE_SAVE_DATA_NEW_MESSAGE`, `DATABASE_SAVE_MESSAGE_UPDATE` e
  `DATABASE_SAVE_DATA_CHATS` seguem `false`. Consequência real: se o CRM estiver
  fora do ar quando a mensagem chegar, **ela é perdida** — não há de onde
  recuperar. `CHATWOOT_ENABLED=true` continua órfão apontando para banco
  inexistente.
- Storage no free tier do Supabase = 1 GB. Áudio enche rápido; migrar para R2
  quando apertar.
- `automation_whatsapp_queue` e os passos de WhatsApp das sequências **ainda
  apontam para a Meta Cloud API**, não para este driver. Ligar na Fase 2.
- Sem rate limit nas rotas novas (igual ao resto do app — item da Fase 5).
