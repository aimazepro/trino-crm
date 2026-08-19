# Handoff — 2026-08-19, fim da sessão de automações WhatsApp

Estado do repo, o que falta fazer e o que falta testar. Escrito para ser lido
por uma sessão nova que não viu nada do que aconteceu antes.

Contexto completo da implementação:
`docs/2026-08-19-whatsapp-evolution-implementacao.md` (leia a seção
"Automações ligadas ao driver" primeiro).

---

## Onde as coisas estão

| | |
|---|---|
| Branch | `main` |
| Working tree | limpo |
| Último commit | `e9a3e9c docs: record the owner-name bug the real automation exposed` |
| Produção | deployado e verificado |
| `origin/main` | **20 commits atrás** — nada foi pushado |

Deploy é manual (`vercel deploy --prod`). `git push` não deploya.

### O que passou a funcionar hoje

WhatsApp via Evolution mergeado em `main` e as automações ligadas ao driver:

```
automação / passo de sequência → automation_whatsapp_queue (pending)
  → pg_cron job 2, a cada minuto
    → POST /api/whatsapp/queue   (auth: AUTOMATION_DISPATCH_SECRET)
      → sendWhatsAppMessage()    ← src/lib/whatsapp/send.ts, mesmo código de /conversas
        → EvolutionDriver
```

Verificado em produção com automação real montada pela UI: mover negócio de
etapa → mensagem entregue no celular em ~30s → aparece em `/conversas` na mesma
thread das mensagens manuais, com `sent_by = null`.

---

## O que falta FAZER, em ordem de valor

### 1. Fila de email — nunca funcionou, agora pode funcionar

O bug que travava a fila do WhatsApp travava a de email pelo mesmo motivo: as
RPCs `claim_pending_*_queue` gravam `status='processing'` e o `CHECK` das duas
tabelas não aceitava esse valor. **Nenhum email de automação jamais saiu deste
CRM.** A migração `20260819220000_queue_status_processing.sql` destravou as
duas, mas só a do WhatsApp foi reescrita.

`supabase/functions/process-email-queue/index.ts` continua sendo o processador,
falando com o Gmail via `integrations`. Nunca foi exercitado com o `claim`
funcionando.

**Decisão a tomar:** deixar na Edge Function ou trazer para o app como foi
feito com o WhatsApp? Trazer para o app dá acesso ao `token-crypto` e ao
refresh de OAuth que já existem em `src/lib/`, e o padrão já está montado —
copiar `src/app/api/whatsapp/queue/route.ts` é o caminho curto.

A tabela está vazia, então não há represa: destravar não dispara nada antigo.

### 2. Automação só dispara no navegador — verificar o alcance

`runAutomations()` (`src/lib/run-automations.ts`) usa o cliente Supabase do
**browser** e é chamada de `src/hooks/use-crm-mutations.ts`. Ou seja: o gatilho
só existe quando alguém mexe no CRM pela tela.

Negócio criado por caminho de servidor **provavelmente não dispara automação
nenhuma**. Rotas que criam negócio sem passar pela UI:

- `src/app/api/import/csv/route.ts`
- `src/app/api/track/[trackId]/route.ts`
- `src/app/api/gmail/sync/route.ts`

A tela de importação tem um checkbox `runAutomations`
(`src/app/configuracoes/importar/page.tsx:144` e `:898`) — **verificar se ele
está de fato ligado a alguma coisa**, porque a função que ele nomeia não roda
no servidor.

Isso importa direto para o modelo de negócio (agência alimenta leads no CRM):
se o lead entra por importação ou API e a automação não dispara, o WhatsApp
automático não acontece justamente no caso que mais paga.

### 3. Limpezas rápidas

- Edge Function `process-whatsapp-queue` continua publicada no Supabase sem ser
  chamada (foi removida do repo). Apagar:
  `supabase functions delete process-whatsapp-queue`
- Template WhatsApp `dfgd` (`whatsapp_templates`) é lixo de teste: só variáveis
  coladas, sem texto. Apagar pela UI.
- Linhas de teste em `automation_whatsapp_queue` podem ser apagadas.

### 4. Pendências antigas que continuam abertas

- Sem rate limit nas rotas novas de WhatsApp (Fase 5).
- Storage no free tier do Supabase = 1 GB; migrar para R2 quando apertar.
- Botão "Anexar" da aba Notas (`src/components/deal/deal-tabs.tsx`) tem
  `<input type="file">` sem handler nenhum.
- Ver também `docs/known-gaps.md`.

---

## O que falta TESTAR

Nada disso foi exercitado. Em ordem de risco:

1. **Passo "WhatsApp" de uma sequência.** Só a automação foi testada. O caminho
   da sequência é outro: `supabase/functions/process-sequences/index.ts`
   enfileira **sem telefone** (a inscrição conhece o negócio, não o número) e a
   rota resolve pelo contato do negócio. Esse ramo do código nunca rodou.
   Criar sequência com passo WhatsApp em `day_offset: 0`, inscrever um negócio,
   esperar o cron de 5 min.

2. **Fila de email ponta a ponta** (ver item 1 acima).

3. **Reaper de linha travada.** Linha que fica em `processing` por mais de 15
   min vira `failed` com "Processamento interrompido antes de concluir".
   Nunca disparou. Testar:
   `update automation_whatsapp_queue set status='processing', created_at=now()-interval '20 minutes' where id='...'`
   e chamar a rota.

4. **Automação com mais de uma mensagem na mesma rodada.** O batch é de 10 por
   chamada, sequencial. Nunca rodou com mais de 1.

5. **Workspace com membro convidado.** Todo o teste foi feito com a conta dona.
   `resolveWorkspaceOwner()` faz um convidado usar a instância do dono — não
   verificado. `team_members` está vazia hoje.

### Limitação conhecida, não é bug

A fila manda **só texto**. Template com imagem, áudio ou documento não existe —
`sendWhatsAppMessage` aceita mídia, mas nada enfileira mídia. Se quiser
automação com mídia, é feature nova.

---

## Como testar uma automação de WhatsApp na prática

1. `Configurações > Templates WhatsApp` → criar template com texto de verdade:
   ```
   Olá {{nome_contato}}, aqui é {{nome_vendedor}}.
   Vi que você tem interesse — posso te ligar hoje?
   ```
   Variáveis que existem: `{{nome_contato}}`, `{{nome_empresa}}`,
   `{{nome_negocio}}`, `{{nome_vendedor}}`. Qualquer outra vira string vazia.
2. Contato de teste com um celular real. Pode ser sem código de país e sem o
   nono dígito — o driver resolve o JID de verdade.
3. Negócio associado a esse contato. Sem contato com número, a fila falha.
4. `Automações` → gatilho "Negócio mudou de etapa" → ação "Enviar WhatsApp" →
   escolher o template → deixar **ativa**.
5. Arrastar o negócio de etapa **pela tela** (ver item 2 das pendências).
6. Esperar até 1 minuto.

Diagnóstico quando não chega:

```sql
select status, phone, error, left(message,60), created_at, sent_at
from automation_whatsapp_queue order by created_at desc limit 5;
```

- linha nem aparece → automação não disparou (gatilho, inativa, ou condição)
- `failed` "Sem telefone" → negócio sem contato, ou contato sem número
- `failed` "não tem WhatsApp" → número inválido
- `failed` "não está conectado" → instância caiu, reconectar em Configurações
- `pending` parada → cron não chegou na rota; olhar `net._http_response`

```sql
select status_code, content, created from net._http_response
order by created desc limit 5;
```

---

## Armadilhas que já custaram caro

Todas documentadas no doc principal e na memória do projeto. As que mais
importam para quem for mexer nisso:

- **Número do contato não é JID.** CRM guarda `38999225622`, WhatsApp responde
  `553899225622` — falta código do país *e* sobra o nono dígito. Nunca montar
  JID por regra; perguntar em `POST /chat/whatsappNumbers`.
- **`team_members` só tem quem foi convidado.** A conta dona do workspace não
  tem linha lá. Buscar nome de vendedor só nessa tabela devolve vazio para todo
  negócio do dono.
- **Rota chamada por máquina precisa entrar na exclusão do `src/proxy.ts`.**
  Senão o middleware responde 307 para `/login`, e `pg_cron` lê 307 como
  sucesso e nunca repete.
- **Negócio é `Ativo`/`Ganho`/`Perdido`**, nunca `"open"`.
- **Áudio precisa ser Opus/Ogg**, e o binário do ffmpeg precisa de
  `outputFileTracingIncludes` no `next.config.ts`.

---

## Segredos

- `AUTOMATION_DISPATCH_SECRET` — autentica `/api/whatsapp/queue`. Está no
  `.env.local`, nas envs de Production da Vercel, e dentro do comando do
  `pg_cron` job 2. Rotacionar significa mudar nos **três**.
- `EVOLUTION_API_KEY` é a chave **global** da Evolution: controla todas as
  instâncias do servidor, inclusive as de clientes. Não colar em chat, issue ou
  commit.
