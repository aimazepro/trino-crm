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

## Segundo bloco da mesma sessão: aba WhatsApp do negócio

`state.whatsappConnected` era um campo de `CrmState` **declarado e nunca
atribuído em lugar nenhum**, e a aba WhatsApp do card do negócio era o único
leitor dele. Resultado: a aba mostrava "Configurar WhatsApp" mesmo com sessão
aberta, e o ramo "conectado" era mockup (composer sem handler).

O campo foi removido, não preenchido: um booleano em cache no estado do CRM
dessincronizaria do provedor assim que a sessão caísse. As duas telas perguntam
para `/api/whatsapp/status` via `useWhatsAppConnection`.

Para não duplicar o chat, a lista de mensagens e o composer viraram um
componente só:

```
src/components/whatsapp/whatsapp-thread.tsx   lista + composer (compartilhado)
src/hooks/use-whatsapp-thread.ts              1 conversa: resolve, carrega, Realtime, envia
src/hooks/use-whatsapp-connection.ts          estado da conexao do workspace
src/hooks/use-whatsapp-inbox.ts               voltou a ser SO a lista de conversas
```

`useWhatsAppThread` resolve qual conversa mostrar: pela inbox é o id
selecionado; pelo negócio tenta `deal_id`, depois `contact_id`, depois os
últimos 8 dígitos do telefone. Quando não existe nenhuma, envia por `phone` e
adota a conversa que o servidor cria — por isso `/api/whatsapp/send` passou a
devolver `conversationId`.

Marcar como lida virou responsabilidade do hook de thread nas duas telas; a
lista reflete por Realtime e mantém o update local só como feedback otimista.

`/conversas` caiu de 610 para 354 linhas.

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


---

## Estado ao fim da primeira sessão de 2026-08-19 (superseded — ver abaixo)

Branch **`feat/whatsapp-evolution`** (2 commits, `main` intocada). **Não
mergeado** — o dono não decidiu ainda. Deployado em produção a partir dela:
`https://trino-crm.vercel.app`.

Verificado: `tsc --noEmit` limpo, `next build` ok, lint sem regressão,
deploy respondendo 200, webhook devolvendo 401 sem segredo.

**Nunca testado com celular de verdade.** Ninguém escaneou o QR ainda. Todo o
caminho ponta a ponta (parear → receber mensagem → ver na tela) continua
não verificado.

### Primeiras coisas a fazer na próxima sessão

1. Perguntar se o teste com celular real foi feito e o que aconteceu. Se falhou,
   os logs de runtime estão em `vercel` (o webhook loga `whatsapp/webhook:
   ingestion failed` e o envio loga `whatsapp/send`).
2. Decidir o merge de `feat/whatsapp-evolution` em `main`.
3. Achado de passagem, fora do escopo, ainda aberto: o botão "Anexar" da aba
   Notas (`src/components/deal/deal-tabs.tsx`, procure por `Anexar`) tem um
   `<input type="file">` sem handler — não anexa nada.


---

## Segunda sessão de 2026-08-19: o pareamento aconteceu, o envio quebrou

A seção acima envelheceu no mesmo dia. O QR **foi escaneado**: a conexão
`trinocrm-joaoreiscefet-5e0c7833` está `open` desde 04:46 UTC, número
`553183091806`, perfil "Trino Marketing". Instância viva e webhook registrado
com o segredo certo (conferido em `GET /webhook/find`), eventos
`QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`.

O que quebrou foi o **envio**:

```
Evolution POST /message/sendText/... failed (400):
{"message":[{"jid":"38999225622@s.whatsapp.net","exists":false,"number":"38999225622"}]}
```

O número saiu do contato do CRM do jeito que uma pessoa escreve — sem código de
país. E botar `55` na frente não resolve sozinho: perguntando ao servidor real,

| perguntado | resposta |
|---|---|
| `38999225622` | `exists: false` |
| `5538999225622` | `exists: true`, jid **`553899225622`** |

O JID canônico tem **um dígito a menos** que o número perguntado. É uma linha
anterior ao nono dígito. Qual das duas formas existe não se deduz do número —
só se pergunta.

### O que mudou

`WhatsAppDriver` ganhou `resolveJid(phone)`, sobre
`POST /chat/whatsappNumbers/{instance}`. `phoneCandidates()` (em `types.ts`)
monta as formas que valem a pergunta, numa requisição só: com código de país,
com o nono dígito somado ou removido, e por último os dígitos crus — senão um
contato internacional guardado como `12125551234` viraria "local com `55` na
frente". Vence o primeiro `exists: true`.

Conversa criada a partir de um telefone do CRM agora guarda o JID **que o
provedor confirmou**, então a resposta que chega pelo webhook cai na mesma
linha em vez de abrir uma segunda thread da mesma pessoa.

Coluna nova `whatsapp_conversations.jid_verified`
(migration `20260819180000_whatsapp_jid_verified.sql`, já aplicada): linhas
criadas por evento de entrada nascem `true` (o JID veio do WhatsApp); linhas
que vieram de um palpite nascem `false` e são **consertadas no próximo envio** —
inclusive fundindo com a conversa canônica quando o lado de entrada já criou
uma. Uma chamada extra por conversa, uma vez.

Número que ninguém alcança devolve **422** com mensagem legível e **não grava
linha de mensagem**: não havia alvo contra o qual falhar.

Verificado: `tsc --noEmit` limpo, `eslint` limpo, `next build` ok,
`phoneCandidates` conferida caso a caso contra o módulo real, resolução
multi-candidato conferida contra o servidor de produção. Deployado
(`trino-crm.vercel.app` respondendo 200, webhook 401 sem segredo).

### Ainda não verificado

**Nenhuma mensagem trafegou ainda** — `whatsapp_messages` está vazia e
`whatsapp_conversations` tem uma linha só, a do João (`jid_verified = false`,
esperando o conserto). Continua sem confirmação de ponta a ponta:

1. Enviar do CRM e a mensagem chegar no celular.
2. Responder do celular e a linha aparecer em `/conversas` por Realtime — este
   é o lado que **nunca** teve um único evento; o webhook está registrado e
   devolve 401 sem segredo, mas nunca processou um `MESSAGES_UPSERT` real.

Se o envio funcionar e a resposta não aparecer, o problema está no webhook, não
no envio: logs em `vercel` sob `whatsapp/webhook: ingestion failed`.

### Pendências herdadas (nenhuma resolvida nesta sessão)

Todas as da seção "Pendências conhecidas" seguem abertas — em especial o
`DATABASE_SAVE_DATA_NEW_MESSAGE=false` no stack da Evolution, que faz mensagem
recebida com o CRM fora do ar ser **perdida sem recuperação**. Decisão do merge
de `feat/whatsapp-evolution` em `main` também segue em aberto, e o botão
"Anexar" da aba Notas continua sem handler.


---

## Terceira sessão de 2026-08-19: primeira conversa real

O envio passou a funcionar e a primeira conversa de verdade derrubou três
coisas de uma vez.

### Áudio chegava vazio

Voice note do WhatsApp é Opus em Ogg, e mais nada. `MediaRecorder` não tem
formato que todo browser produza: Chrome e Firefox dão Opus, Safari dá AAC em
container mp4. A Evolution **aceitou e entregou o AAC** — por isso parecia
envio bem-sucedido, e o erro só aparecia no celular, como nota sem onda e com
duração 0:00.

Áudio de saída agora é reencodado para Opus mono 48 kHz com `ffmpeg-static`
(`src/lib/whatsapp/audio.ts`) antes de sair. O storage guarda o **original**: o
browser que gravou consegue tocar de volta, e Safari não toca ogg. Conversão
que falha cai no original em vez de descartar uma gravação já feita.

`next.config.ts` precisou de `outputFileTracingIncludes` para
`/api/whatsapp/send`: o tracing só segue `require`, e o ffmpeg-static resolve o
binário como caminho em runtime. Sem isso o build local passa verde e a
produção cai no fallback — o bug exato que a conversão existe para resolver.

### "Abrir negócio" nunca aparecia

O botão já existia em `/conversas`. Os dois call sites filtravam
`deals.status = "open"`, e aqui negócio é **`Ativo` / `Ganho` / `Perdido`**.
Não casava com nada, então toda conversa nascia com `deal_id` null.

A busca virou `src/lib/whatsapp/linking.ts`, usada pelo webhook e pelo envio —
tinham que concordar, senão a conversa aberta pelo negócio e a mesma conversa
reencontrada na resposta viram duas linhas. Prefere o negócio `Ativo`, cai pro
mais recente quando todos já fecharam.

### Assinatura por workspace

`whatsapp_connections.signature_enabled` + `signature_name` (migration
`20260819200000_whatsapp_signature.sql`, aplicada). Prefixo `*Nome*` + quebra
de linha em texto e legenda, no estilo Chatwoot/painel da Evolution.
`PATCH /api/whatsapp/settings`, só o dono. **Desligada por padrão** — ligar
muda o que todo cliente recebe. Nome cai pro nome da conta, e a rota recusa
ativar sem nome, senão o toggle parece quebrado.

O corpo gravado no banco é o **assinado**: a thread mostra o que o cliente
recebeu, não uma versão mais limpa.

### Gravador e visual

`src/components/whatsapp/voice-recorder.tsx`: waveform ao vivo por
`AnalyserNode`, pausar/retomar, ouvir antes de enviar, descartar. Pede Opus ao
`MediaRecorder` primeiro, então quem consegue produzir poupa o reencode do
servidor.

Thread reescrita: mensagens agrupadas por remetente, rabinho só na última
bolha da sequência, papel e cores do WhatsApp nos dois temas, tique de lida
azul.

### Estado real da conexão

Pareada e viva: `553183091806` ("Trino Marketing"), instância
`trinocrm-joaoreiscefet-5e0c7833`, status `open`. Texto, imagem e áudio saem e
chegam no celular.

**Continua sem verificação: a entrada.** `whatsapp_messages` só tem mensagens
`from_me`. Nenhum `MESSAGES_UPSERT` de mensagem recebida jamais foi processado
— o webhook está registrado, devolve 401 sem segredo, e os `MESSAGES_UPDATE`
chegam (é por isso que o status vira `delivered`), mas ninguém respondeu do
celular ainda. **Esse é o primeiro teste da próxima sessão.** Se falhar, o log
é `whatsapp/webhook: ingestion failed` no `vercel`.

Pendências herdadas seguem todas abertas, em especial
`DATABASE_SAVE_DATA_NEW_MESSAGE=false` no stack da Evolution (mensagem
recebida com o CRM fora do ar é perdida sem recuperação) e a decisão do merge
de `feat/whatsapp-evolution` em `main`.
