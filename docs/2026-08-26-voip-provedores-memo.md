# Memo de Decisão — Provedores de Telefonia/VoIP com API para revenda de minutos no TrinoCRM

**Data:** 2026-08-26
**Autor:** pesquisa assistida (Claude) — todas as fontes citadas por URL
**Contexto:** TrinoCRM quer embutir voz no produto e **revender minutos aos workspaces clientes com margem**, cobrando R$ 0,38/min do cliente final.

---

## 0. Como ler este documento (regras de honestidade)

Este memo distingue três níveis de confiança. Respeite-os antes de tomar decisão:

| Marcador | Significado |
|---|---|
| **[FONTE]** | Número lido diretamente da página do provedor, com URL. |
| **[SECUNDÁRIO]** | Número de terceiro (blog, comparador, imprensa, Reclame Aqui). Pode estar errado ou desatualizado. |
| **NÃO PÚBLICO** | O provedor não publica. Exige contato comercial. **Não estimei.** |
| **[MINHA PREMISSA]** | Cálculo meu, com a premissa explicitada. Não é dado de fonte. |

**Premissa de câmbio usada em todos os cálculos em USD → BRL: R$ 5,40 / US$ 1,00. [MINHA PREMISSA]**
Não tenho cotação ao vivo. **Atualize antes de decidir.** Todas as conversões abaixo escalam linearmente — basta multiplicar pelo câmbio real / 5,40.

**Premissa adicional não modelada:** compras em USD por cartão/remessa sofrem IOF + spread cambial (ordem de 4% a 6%). Isso corrói a margem de qualquer provedor gringo e **não está embutido** nos números abaixo. Some isso mentalmente aos provedores em USD.

---

## 1. Achado que muda a conversa

> **R$ 0,38/min é exatamente o preço de tabela histórico da API4COM para celular.**

A API4COM anunciava R$ 0,38/min para celular no Brasil ([SECUNDÁRIO] — snippet indexado de api4com.com, corroborado por reclamação pública citando o mesmo valor: <https://www.reclameaqui.com.br/api4com-tecnologia-e-servicos/cobranca-indevida-de-valores-divergentes-na-api4con_YwEA3ReMtsW9XhnM/>).

Ou seja: **o preço que o TrinoCRM pretende cobrar do cliente final é o preço de varejo de um concorrente direto brasileiro.** Isso tem duas implicações:

1. **Teto de mercado.** R$ 0,38/min não é um preço "com margem" — é o preço que o cliente consegue sozinho, sem o CRM. A margem tem que vir de *custo de atacado bem abaixo disso*, não de markup sobre varejo.
2. **Risco competitivo.** Se o cliente descobrir que R$ 0,38 é tabela pública de balcão, a percepção vira "o CRM não me dá desconto nenhum". Considere posicionar como pacote (minutos + gravação + IA + CRM) e não como minuto avulso.

**Recomendação de posicionamento:** ou (a) negocie atacado que permita vender a R$ 0,25–0,29 e ainda ter margem, ou (b) mantenha R$ 0,38 mas empacote gravação/transcrição/relatório no preço para justificar.

---

## 2. Fichas por provedor

### 2.1 API4COM 🇧🇷

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **R$ 0,38/min** (tabela histórica); tarifas **reajustadas em 01/08/2025** (contas novas) e **16/09/2025** (contas existentes) — **valor atual NÃO PÚBLICO** | [SECUNDÁRIO] + <https://www.api4com.com/blog/atualizacao-plano-tarifas> |
| Minuto fixo BR | NÃO PÚBLICO | — |
| Mensalidade por usuário | **Suporte R$ 9,90/user (até 60 min/mês)** · **Negociação R$ 99,90/user (até 300 min/mês)** · **Ilimitado R$ 199,90/user** | <https://www.api4com.com/blog/o-que-aprendemos-com-nossos-planos-desde-o-lancamento-e-o-que-muda-a-partir-de-agora> |
| ⚠️ Divergência | A home atual anuncia **Negociação a R$ 149,90/user/mês** (300 min) e **Ilimitado R$ 199,90** (R$ 165,92/user no anual) — **conflita com o blog acima (R$ 99,90)** | <https://www.api4com.com/> |
| DID brasileiro/mês | NÃO PÚBLICO | — |
| Gravação | "Gravação 100% das chamadas" inclusa nos planos; custo de armazenamento NÃO PÚBLICO | <https://www.api4com.com/> |
| API de subcontas | **NÃO DOCUMENTADA.** Endpoints públicos: `Account.*`, `Extension.*` (por domínio), `Dialer.doCall`, `Call.find`/`Call.hangupCall`, `Credit.balance`, `Charge.*`. Existe "Portal do Parceiro" mas termos não públicos | <https://developers.api4com.com/> |
| SDK WebRTC navegador | **SIM** — Webphone baseado na lib open-source **Kazoo Webphone v2.0**. Login SIP com ramal + senha + domínio `seudominio.api4com.com`. Restrição: webphone é **singleton** (nova instância derruba a anterior) | <https://developers.api4com.com/integration-own-webphone.html> · <https://developers.api4com.com/integration-api4com-webphone.html> |
| Webhooks de chamada | **SIM** — eventos `channel-answer` e `channel-hangup`. Config via `PATCH /integrations` com `webhookUrl`, `webhookVersion` (só "1.8"), `webhookTypes`, e `webhookConstraint` (filtro por metadata). Payload traz call id, duração, timestamps (started/answered/ended), causa do hangup, **URL da gravação** e metadata | <https://developers.api4com.com/operations/UserIntegration.overrideUpsert.html> |
| ⚠️ Falta | **Não há evento de `ringing`** documentado — só answer e hangup | idem |
| Faturamento | **BRL.** Pré-pago por crédito (PIX/boleto/cartão) ou assinatura recorrente. Processamento via **Asaas** | <https://www.api4com.com/termos-de-uso> |
| Bina dinâmica | **SIM** — recurso de marketing na home ("Bina Dinâmica" / DDD local do destino) | <https://www.api4com.com/> |
| CNPJ | Empresa BR; requisito para DID não explicitado publicamente | — |

**🚩 Dois sinais de alerta sérios:**

1. **Pay-as-you-go está sendo descontinuado.** O próprio blog anuncia a migração para "3 níveis de serviço com mensalidade fechada" e diz que o PAYG será encerrado — "sem definição de data", com compromisso de 6 meses de aviso. <https://www.api4com.com/blog/atualizacao-plano-tarifas>
   → **Construir revenda de minutos sobre um modelo que o fornecedor está matando é risco estrutural.**
2. **Reclamação pública de divergência de cobrança:** cliente alega tabela anunciada de R$ 0,38/min para celular e cobrança efetiva de ~**R$ 0,726/min**. [SECUNDÁRIO] <https://www.reclameaqui.com.br/api4com-tecnologia-e-servicos/cobranca-indevida-de-valores-divergentes-na-api4con_YwEA3ReMtsW9XhnM/>
   → **Se for adiante, exija contrato com tabela anexada e cláusula de reajuste, e reconcilie CDR vs fatura no primeiro mês.**
3. Mudança adicional: chamadas ≤ 3 segundos **passaram a ser tarifadas** a partir de ago/2025 (antes eram isentas). Impacta discagem em volume/preditiva. <https://www.api4com.com/blog/atualizacao-plano-tarifas>

---

### 2.2 Zenvia Voice (ex-TotalVoice) 🇧🇷

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **NÃO PÚBLICO — exige contato comercial.** A página de preços atual não traz voz PSTN | <https://zenvia.com/precos> |
| Histórico (desatualizado) | R$ 0,06/min fixo e **R$ 0,35/min celular** no plano de entrada — **matéria de 2018**, não use como base | [SECUNDÁRIO] <https://scinova.com.br/total-voice-startup-que-se-reinventou-para-crescer-seis-vezes-em-um-ano/> |
| Ligações WhatsApp (referência de tabela pública) | R$ 0,0950/min (pacote R$ 100) → R$ 0,0812/min (pacote R$ 2.000) | <https://zenvia.com/precos?totalvoice-preco=#product-voz> |
| Mensalidade por ramal | NÃO PÚBLICO (modelo é pay-as-you-go por crédito, pré ou pós-pago) | <https://zenvia.com/termos/plataforma-voz/> |
| DID brasileiro/mês | NÃO PÚBLICO — a própria Zenvia manda contatar `suporte.voz@zenvia.com` | KB Zenvia |
| Gravação | `GET /chamada/{id}/gravacao` recupera a gravação. Custo NÃO PÚBLICO | <https://totalvoice.github.io/totalvoice-docs/> |
| **API de subcontas** | ✅ **SIM, e é o recurso mais alinhado do mercado.** Recurso **"Conta Filha"**: `POST /conta`, `GET /conta/{id}`, `PUT /conta/{id}`, `DELETE /conta/{id}`, `GET /conta/relatorio`. A doc diz literalmente que serve para *"integrações de sistemas, **revenda de serviços** e uso de funções de telefonia por terceiros"*, mediante permissão de **conta pai** | <https://totalvoice.github.io/totalvoice-docs/> |
| SDK WebRTC navegador | ✅ **SIM — e no formato ideal para CRM.** Endpoint `/webphone` retorna uma URL; com `tipo=hidden` você recebe um **webphone headless** injetado via `<script>`/iframe, controlado por `postMessage`. Eventos de volta: `chegandoChamada`, `status` (connected/disconnected/calling), `chamada_id`, `status_erro` | <https://zenvia.com/blog/como-integrar-seu-sistema-com-o-webphone/> · <https://voice-app.zenvia.com/doc/> |
| Webhooks de chamada | ✅ SIM — POST no seu endpoint para mudança de status de chamada, atividade de ramal, chamada receptiva em DID, conferência, saldo, correio de voz, conclusão de TTS/áudio | <https://totalvoice.github.io/totalvoice-docs/> · <https://www.totalvoice.com.br/webhooks/> |
| Outros endpoints úteis | `POST /chamada`, `GET /chamada/{id}`, `DELETE /chamada/{id}`, `GET /chamada/relatorio`, `POST /chamada/{id}/transferir`, `GET /did`, `PUT /did/{id}`. Base: `https://voice-api.zenvia.com/`, header `Access-Token` | idem |
| Faturamento | **BRL.** Pré-pago (crédito/recarga) ou pós-pago | <https://zenvia.com/termos/plataforma-voz/> |
| Bina dinâmica | NÃO DOCUMENTADO publicamente — perguntar ao comercial | — |
| CNPJ | Provedor BR; requisito não explicitado publicamente | — |

---

### 2.3 Nvoip 🇧🇷

| Item | Valor | Fonte |
|---|---|---|
| Minuto BR | **"a partir de R$ 0,05/min"**, sem taxa de conexão, para Brasil + 192 países. **A separação celular vs fixo NÃO É PÚBLICA** (site protegido por Cloudflare, não consegui abrir a tabela) | <https://www.nvoip.com.br/en/rates/> (via índice de busca) |
| Plano ilimitado | R$ 299,99/ramal/mês com fixo+móvel ilimitado (plano 0800) | [SECUNDÁRIO] <https://www.falemaisvoip.com.br/blog/operadora-voip-mais-barata/> |
| Mensalidade por ramal | NÃO PÚBLICO (modelo principal é crédito avulso, sem taxa de ativação) | [SECUNDÁRIO] idem |
| DID brasileiro/mês | **NÃO PÚBLICO** — cobra ativação + mensalidade. Cobertura nos 26 estados + DF; 5 chamadas simultâneas por número | <https://www.nvoip.com.br/en/virtual-number/> |
| Gravação | Oferecida (gravação, URA, filas, horários, transbordo). Custo NÃO PÚBLICO | <https://www.nvoip.com.br/blog/voip/> |
| API de subcontas | **NÃO DOCUMENTADA publicamente** | — |
| SDK WebRTC navegador | Tem webphone próprio; **SDK JS documentado para embutir em app de terceiro NÃO ENCONTRADO**. Integração é via API v2 + OAuth token derivado de SIP User (ramal) + User-Token | <https://github.com/Nvoip/nvoip-integrationAPI> · <https://www.nvoip.com.br/en/api-en/> |
| Webhooks | Citados no material institucional ("APIs, webhooks e CRMs que recebem eventos de chamada"); **catálogo de eventos não encontrado em doc pública** | <https://www.nvoip.com.br/blog/voip/> |
| Faturamento | **BRL** | — |

**Avaliação:** preço potencialmente o mais competitivo do lote brasileiro (R$ 0,05/min de piso), mas **a documentação pública é a mais fraca dos finalistas brasileiros** e o site bloqueia crawling. É um candidato a **cotação**, não a decisão baseada em doc.

---

### 2.4 Directcall 🇧🇷

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **NÃO PÚBLICO — exige contato comercial** (0800 724 0804) | <https://directcall.com.br/produto/api/> |
| Mensalidade por ramal | **3CX Ramal IP a partir de R$ 47,90** no plano ilimitado; outra fonte cita **R$ 24,90/ramal**. Planos-base de telefonia ~R$ 60–220/mês | <https://directcall.com.br/produtos/3cx-ramal-ip/> · [SECUNDÁRIO] |
| DID brasileiro/mês | NÃO PÚBLICO. Cobertura: **478 cidades brasileiras** + 40 países | <http://directcall.com.br/produto/telefone-virtual/> |
| Gravação | Sim, com histórico de **até 5 anos**, recuperável por clique/API | <https://directcall.com.br/produto/api/funcionalidades/> |
| API de subcontas | **Painel web multi-nível** (`gestor.directcallsoft.com`) com níveis de acesso e bloqueio por usuário — **mas API de subcontas não documentada** | idem |
| SDK WebRTC | Softphone browser + apps iOS/Android, majoritariamente via **3CX**. **SDK JS próprio não documentado** | idem |
| Webhooks | Callbacks para CRM citados; catálogo de eventos não público | idem |
| Diferencial real | **Consulta de portabilidade/CSP** de número BR com resposta ≤ 600 ms — útil para rotear celular vs fixo corretamente e não errar tarifa | idem |
| Faturamento | **BRL** | — |

---

### 2.5 55PBX 🇧🇷

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **NÃO PÚBLICO — exige contato comercial.** A página de planos só diz "custos abaixo do mercado" e promete cobrir concorrente | <https://www.55pbx.com/pabx-virtual/plano> |
| Mensalidade | "a partir de R$ 39,00/mês" | [SECUNDÁRIO] <https://www.getapp.com/customer-service-support-software/a/55pbx/> |
| ⚠️ Tarifação | **Chamadas com menos de 60s são cobradas como 1 minuto cheio.** Isso destrói margem em operação de CRM (muita chamada curta / caixa postal) | <https://suporte.55pbx.com/support/solutions/articles/151000092914--tipos-de-tarifac%C3%A3o> |
| DID | NÃO PÚBLICO | — |
| API de subcontas | **NÃO DOCUMENTADA** | — |
| SDK WebRTC | Softphone 55PBX (app embarcado em Zendesk/Salesforce/HubSpot etc.), **não um SDK JS para você embutir** | <https://www.zendesk.com/marketplace/apps/support/93858/55pbx-softphone-pabx-virtual/> |
| Webhooks | ✅ **Realtime API** faz POST no seu endpoint a cada evento de chamada. Também: Discadora API (preditiva), Report API, Secure URA API | <https://api-55pbx.readme.io/> |
| ⚠️ Atrito | Autenticação usa `client_code` **e** `api_key`, **ambos precisam ser solicitados ao suporte** — não há self-service | <https://suporte.55pbx.com/support/solutions/articles/151000180038-guia-de-habilitac%C3%A3o-de-tokens-para-integrac%C3%A3o-com-a-api-55pbx> |
| Faturamento | **BRL** | — |

**Avaliação:** posicionado como *contact center pronto*, não como *CPaaS para revenda*. O onboarding manual de credenciais inviabiliza provisionar workspace automaticamente.

---

### 2.6 Twilio 🌎

| Item | Valor | Fonte |
|---|---|---|
| **Minuto celular BR (saída)** | **US$ 0,0663/min** = **R$ 0,358/min** [MINHA PREMISSA de câmbio] | <https://www.twilio.com/en-us/voice/pricing/br> |
| **Minuto fixo/local BR (saída)** | **US$ 0,0310/min** = R$ 0,167/min | idem |
| Entrada em número local BR | **US$ 0,0100/min** | idem |
| DID local BR/mês | **US$ 4,25/mês** = R$ 22,95 | idem |
| Gravação | **US$ 0,0025/min** de gravação; armazenamento **grátis nos primeiros 10.000 min/mês**, depois **US$ 0,0005/min/mês** | <https://support.twilio.com/hc/en-us/articles/223132527-How-Much-Does-It-Cost-to-Record-a-Call> |
| Mensalidade por ramal | **Não existe.** Programmable Voice é 100% consumo | <https://www.twilio.com/en-us/voice/pricing/br> |
| **API de subcontas** | ✅ **SIM, maduro.** `POST /2010-04-01/Accounts`. Até **1000 subcontas** por conta-mãe (mais, sob solicitação). Cada subconta tem seu próprio Account SID, números, caller IDs, SIP domains, gravações. **Billing consolidado na conta-mãe** (um único saldo) | <https://www.twilio.com/docs/iam/api/subaccounts> |
| SDK WebRTC navegador | ✅ **Voice JavaScript SDK** (`Twilio.Device`) — Chrome, Firefox, Safari, Edge | <https://www.twilio.com/docs/voice/sdks/javascript> · <https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice> |
| Webhooks | ✅ StatusCallback com ciclo completo (initiated/ringing/answered/completed) + CDR na API | <https://www.twilio.com/docs/voice> |
| Faturamento | **USD** — soma IOF + spread na conversão | — |
| **CNPJ / regulatório** | ✅ **EXIGE.** CNPJ válido + comprovante de endereço físico no Brasil (conta de consumo ou contrato social) para números local/nacional/toll-free. **Pessoa física não pode adquirir.** Regulatory Bundle revisado em até 2 dias úteis. Anatel limita **5 números 0800 por CNPJ** | <https://www.twilio.com/en-us/guidelines/br/regulatory> · <https://support.twilio.com/hc/en-us/articles/8338625205147-How-to-Submit-a-Regulatory-Bundle-for-Phone-Number-Regulatory-Compliance> |
| **⚠️ Bina** | Caller ID **precisa ser número Twilio seu ou Verified Caller ID**. Desde 12/04/2024 o Twilio bloqueia CLI não verificada (erro **32204**). **Bina dinâmica por DDD = comprar N DIDs a US$ 4,25/mês cada** | <https://support.twilio.com/hc/en-us/articles/223179848-Using-a-non-Twilio-number-as-the-caller-ID-for-outgoing-calls> |

**Nota sobre o custo real por chamada:** uma chamada browser→PSTN no Twilio tem **duas pernas** — a perna do SDK (client) e a perna PSTN. A tabela pública de BR mostra a perna PSTN. **Confirme com o comercial se a perna do Voice JS SDK é cobrada à parte** (está na lista de perguntas). Se for, a margem cai mais.

---

### 2.7 Telnyx 🌎

| Item | Valor | Fonte |
|---|---|---|
| **Minuto celular BR** | **NÃO PÚBLICO — exige download do rate sheet global ou contato comercial.** Tentei `/pricing/voice-api/br` (404) e o seletor de país não expõe a tarifa BR no HTML | <https://telnyx.com/pricing/voice-api> |
| Estimativa de terceiro | US$ 0,135/min para BR móvel [SECUNDÁRIO, **suspeito**] — <https://www.ringlyn.com/blog/sip-trunk-pricing-2026-comparison/>. **Desconfie:** a mesma tabela diz US$ 0,150/min para o Twilio em BR móvel, mas a página oficial do Twilio diz US$ 0,0663. Fonte provavelmente errada — **não use** |
| Taxa de plataforma Voice API | **US$ 0,002/min** (soma-se à terminação SIP) | <https://telnyx.com/pricing/call-control> |
| Perna WebRTC / browser | **US$ 0,002/min** ("browser/app calling"); interface SIP US$ 0,002/min; media streaming sobre WS US$ 0,0035/min | idem |
| Gravação | **US$ 0,002/min** de gravação; **armazenamento US$ 0,00/min** (grátis) | idem |
| DID brasileiro/mês | **a partir de US$ 3,00/mês** = R$ 16,20 | <https://telnyx.com/phone-numbers/brazil> |
| Mensalidade por ramal | Não existe (consumo puro) | — |
| **API de subcontas** | ✅ **SIM — "Managed Accounts", pensado para MSP/revenda.** Subcontas **herdam pricing da conta-mãe** e recebem automaticamente as tarifas melhores de contratos com compromisso. Cada uma tem **saldo, meio de pagamento e faturas próprias**. Manager pode criar API key da subconta e controlá-la via API. ⚠️ **Limited release:** exige aprovação manual do comercial/suporte + **verificação L2** | <https://developers.telnyx.com/docs/account/managed-accounts> · <https://telnyx.com/release-notes/managed-accounts> · <https://developers.telnyx.com/api/managed-accounts/enable-managed-account> |
| SDK WebRTC navegador | ✅ **`@telnyx/webrtc`** (JS, open source) + **React SDK**. Auth por JWT ou credenciais de SIP Connection. Objetos `TelnyxRTC` / `Call` / `notification`. Inclui métricas de qualidade de chamada | <https://developers.telnyx.com/development/webrtc> · <https://www.npmjs.com/package/@telnyx/webrtc> · <https://developers.telnyx.com/docs/voice/webrtc/reactsdk> · <https://github.com/team-telnyx/webrtc> |
| Webhooks | ✅ Call Control webhooks (ciclo completo de eventos de chamada) | <https://telnyx.com/pricing/call-control> |
| Faturamento | **USD** | — |
| CNPJ / regulatório | A própria página de regulação BR do Telnyx diz **"Information is coming soon"** — ou seja, **não há guia público**. Assuma exigência de CNPJ e confirme com o comercial | <https://telnyx.com/phone-numbers/brazil> |

---

### 2.8 Plivo 🌎 — ❌ **DESQUALIFICADO**

| Item | Valor | Fonte |
|---|---|---|
| **Minuto celular BR (saída)** | ❌ **"Not Supported"** — Plivo **não faz chamada de saída para celular brasileiro**, nem no Voice nem no SIP Trunking | <https://www.plivo.com/voice/pricing/br/> · <https://www.plivo.com/sip-trunking/pricing/br/> |
| Minuto fixo BR (saída) | US$ 0,0200/min (US$ 0,0180/min grandes capitais) | idem |
| Entrada | US$ 0,0060/min (local) · US$ 0,1800/min (toll-free) | idem |
| DID local BR/mês | US$ 5,00/mês (toll-free US$ 30,00/mês) | idem |
| ⚠️ Tarifação | Incremento **30/30** (mínimo 30s, blocos de 30s) | idem |

**Veredito:** num CRM brasileiro a esmagadora maioria dos leads é celular. Um provedor que não termina em móvel BR **não atende ao caso de uso**. Encerrado.

---

### 2.9 Vonage 🌎

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **NÃO PÚBLICO — exige baixar a planilha global de preços ou falar com vendas** | <https://www.vonage.com/communications-apis/voice/pricing/> |
| Nota de tarifação | Preço de tabela vale para redes Fixa e Móvel; para outros tipos (Virtual, VoIP, Outbound Toll Free) cobra-se o **default de € 0,414** — armadilha cara se o roteamento classificar errado | <https://api.support.vonage.com/hc/en-us/articles/204015203-How-does-voice-pricing-work-for-inbound-and-outbound-calls> |
| Faturamento | USD/EUR | — |

**Veredito:** sem preço público de BR, sem diferencial claro de multi-tenancy sobre Twilio/Telnyx. Não avança.

---

### 2.10 Infobip 🌎

| Item | Valor | Fonte |
|---|---|---|
| Minuto celular BR | **NÃO PÚBLICO.** A página só mostra "preço médio entre todos os países"; preço por rede só dentro do Portal / calculadora | <https://www.infobip.com/voice/pricing> |
| Calls API | Existe (voz + vídeo) | <https://www.infobip.com/docs/voice-and-video/calls> |

**Veredito:** opacidade total de preço. Empresa com forte presença BR, vale uma cotação, mas não dá para modelar margem sem falar com vendas. Não avança para finalista.

---

### 2.11 SignalWire 🌎

| Item | Valor | Fonte |
|---|---|---|
| Minuto BR | **Brasil não listado na página de preços** | <https://signalwire.com/pricing> |
| Referência publicada | PSTN saída US$ 0,0080/min · toll-free saída US$ 0,0069/min · transporte **SIP/WebRTC US$ 0,0030/min** · AI runtime US$ 0,16/min | idem |

**Veredito:** preços atraentes, mas sem cobertura BR publicada. Não avança.

---

### 2.12 Vono (Grupo Vono) 🇧🇷 / Vonex

| Item | Valor | Fonte |
|---|---|---|
| DID fixo virtual | **R$ 14,00/mês** | [SECUNDÁRIO] <https://www.minhaoperadora.com.br/2022/04/vono-telecom-o-que-e-numero-virtual-e-como-adquirir-um.html> (2022 — pode estar desatualizado) |
| Minuto celular | **NÃO PÚBLICO** | — |
| API / SDK WebRTC / subcontas | **NÃO DOCUMENTADOS publicamente.** Portfólio é PABX virtual, SIP Trunk, SMS, mobilidade | <https://grupovono.com.br/> |

**Nota de correção:** **Vonex** é uma operadora **australiana**, sem relação com a Vono brasileira. Não é candidata para este caso.

---

## 3. Tabela comparativa

| Provedor | Min. celular BR | Min. fixo BR | Mensal/ramal | DID BR/mês | Gravação | Subcontas API | SDK WebRTC | Webhooks | Moeda | CNPJ |
|---|---|---|---|---|---|---|---|---|---|---|
| **API4COM** | R$ 0,38 (tabela histórica; **atual não público**) | não público | R$ 9,90 / 99,90 / 199,90 (home diz 149,90) | não público | inclusa | ❌ não documentada | ✅ Kazoo Webphone (SIP/WSS) | ✅ answer + hangup (sem ringing) | BRL | provável |
| **Zenvia Voice** | **não público** | não público | não (consumo) | não público | ✅ `GET /chamada/{id}/gravacao` | ✅ **Conta Filha (`/conta`) — doc cita revenda** | ✅ Webphone `tipo=hidden` + postMessage | ✅ completo | BRL | provável |
| **Nvoip** | "a partir de R$ 0,05" (split não público) | não público | R$ 299,99 (ilimitado)¹ | não público | sim, custo n/p | ❌ não documentada | ⚠️ webphone sim, SDK n/d | ⚠️ citados, catálogo n/d | BRL | provável |
| **Directcall** | **não público** | não público | R$ 24,90–47,90¹ | não público | ✅ 5 anos | ❌ painel multi-nível, API n/d | ⚠️ via 3CX | ⚠️ citados | BRL | provável |
| **55PBX** | **não público** | não público | a partir de R$ 39¹ | não público | sim | ❌ | ⚠️ softphone embarcado | ✅ Realtime API | BRL | provável |
| **Twilio** | **US$ 0,0663** ✅ | **US$ 0,0310** ✅ | ❌ não há | **US$ 4,25** ✅ | US$ 0,0025/min + storage | ✅ 1000 subcontas | ✅ Voice JS SDK | ✅ StatusCallback | USD | ✅ **exige** |
| **Telnyx** | **não público** (plataforma US$ 0,002 + terminação) | não público | ❌ não há | **US$ 3,00** ✅ | US$ 0,002/min, **storage grátis** | ✅ **Managed Accounts** (limited release) | ✅ `@telnyx/webrtc` + React | ✅ Call Control | USD | não documentado |
| **Plivo** | ❌ **não suportado** | US$ 0,0200 | ❌ | US$ 5,00 | — | ✅ subaccounts | ✅ | ✅ | USD | — |
| **Vonage** | não público | não público | ❌ | não público | — | ✅ | ✅ | ✅ | USD/EUR | — |
| **Infobip** | não público | não público | não público | não público | — | ⚠️ | ⚠️ | ✅ | não público | — |
| **SignalWire** | ❌ BR não listado | ❌ | ❌ | não público | — | ✅ subprojects | ✅ | ✅ | USD | — |
| **Vono** | não público | não público | não público | R$ 14,00¹ | n/d | ❌ | ❌ | ❌ | BRL | provável |

¹ = [SECUNDÁRIO], não confirmado em página oficial do provedor.

---

## 4. Cálculo de margem — vendendo a R$ 0,38/min

**Premissas:** câmbio **R$ 5,40/US$** [MINHA PREMISSA]. **IOF/spread não incluído** (some ~4–6% aos provedores em USD). Custo considerado = terminação celular + gravação, quando ambos forem públicos.

### 4.1 Onde dá para calcular

| Provedor | Custo/min celular | Gravação/min | **Custo total/min** | **Margem bruta R$** | **Margem %** |
|---|---|---|---|---|---|
| **Twilio** | US$ 0,0663 = R$ 0,358 | US$ 0,0025 = R$ 0,0135 | **R$ 0,3715** | **R$ 0,0085** | **2,2%** 🔴 |
| **Twilio** (sem gravar) | R$ 0,358 | — | R$ 0,358 | R$ 0,022 | 5,8% 🔴 |
| **API4COM** (tabela R$ 0,38 histórica) | R$ 0,38 | inclusa | **R$ 0,38** | **R$ 0,00** | **0%** 🔴 |
| **API4COM** (se a reclamação de R$ 0,726 proceder) | R$ 0,726 | inclusa | R$ 0,726 | **−R$ 0,346** | **−91%** 🔴🔴 |
| **Plivo** | ❌ não termina em celular BR | — | — | — | inviável |

**Leitura:** com preços públicos, **nenhum provedor fecha margem decente a R$ 0,38/min.** O Twilio ainda fica negativo depois de IOF. A API4COM a preço de tabela dá **zero**.

### 4.2 O modelo por usuário da API4COM inverte o risco (calcule o ponto de equilíbrio)

Se você comprar o plano **Ilimitado a R$ 199,90/usuário** e revender a R$ 0,38/min, a conta vira uma aposta em utilização:

**Ponto de equilíbrio = R$ 199,90 ÷ R$ 0,38 = 526 minutos/usuário/mês.** [MINHA PREMISSA de cálculo]

| Uso real do usuário | Sua receita | Seu custo | Resultado |
|---|---|---|---|
| 300 min/mês | R$ 114,00 | R$ 199,90 | **−R$ 85,90** 🔴 |
| 526 min/mês | R$ 199,88 | R$ 199,90 | empate |
| 1.000 min/mês | R$ 380,00 | R$ 199,90 | **+R$ 180,10 (47%)** 🟢 |
| 2.000 min/mês | R$ 760,00 | R$ 199,90 | **+R$ 560,10 (74%)** 🟢 |

E o plano **Negociação** é pior ainda: R$ 149,90 por 300 min = **R$ 0,4997/min no uso pleno**, já acima do seu preço de venda. **Nunca revenda em cima do Negociação.**

> ⚠️ **Este é o achado comercial central:** um plano ilimitado por usuário só gera margem se seus clientes forem discadores pesados (>526 min/user/mês). Se o perfil for atendimento leve, você paga fixo e cobra variável — e perde. Antes de fechar, **meça a distribuição de minutos por usuário nos seus workspaces atuais.**

### 4.3 Onde NÃO dá para calcular (e o alvo que você precisa negociar)

Zenvia, Nvoip, Directcall, 55PBX, Telnyx, Vonage e Infobip **não publicam o minuto celular BR**. Em vez de estimar, use isto como **meta de negociação**:

| Margem alvo sobre R$ 0,38 | Custo máximo aceitável (BRL) | Equivalente em USD @ R$ 5,40 |
|---|---|---|
| 30% | R$ 0,266/min | US$ 0,0493/min |
| **40%** | **R$ 0,228/min** | **US$ 0,0422/min** |
| 50% | R$ 0,190/min | US$ 0,0352/min |
| 60% | R$ 0,152/min | US$ 0,0281/min |
| 70% | R$ 0,114/min | US$ 0,0211/min |

**Use esta tabela na negociação.** Diga o número: *"preciso de celular BR a R$ 0,22 ou menos, tudo incluso, para o modelo fechar."*

Referência de sanidade: a Nvoip anuncia piso de **R$ 0,05/min** e a Zenvia praticava **R$ 0,35 celular em 2018**. O intervalo realista de atacado BR provavelmente está entre R$ 0,10 e R$ 0,25 — mas **isso é inferência minha, não fonte.**

### 4.4 Custos que somem da conta e comem a margem

Modele estes antes de fechar qualquer contrato:

1. **DID por workspace.** Twilio US$ 4,25/mês, Telnyx US$ 3,00/mês. Com 100 workspaces = **US$ 425 ou US$ 300/mês fixos**.
2. **Bina dinâmica.** O Brasil tem 67 DDDs. Cobrir todos no Twilio = 67 × US$ 4,25 = **US$ 284,75/mês por conta**, e no Twilio o caller ID **tem que ser número seu ou verificado** (erro 32204). Provedores brasileiros que já entregam bina dinâmica como recurso (API4COM) resolvem isso sem você comprar 67 números.
3. **Tarifação mínima.** 55PBX arredonda tudo para 1 minuto cheio; Plivo usa blocos de 30/30. Numa operação de CRM com muita chamada de 15–25 segundos, isso pode **dobrar o custo efetivo por minuto útil**.
4. **Chamadas curtas.** API4COM passou a tarifar chamadas ≤ 3s. Discagem em volume gera muitas.
5. **Perna do WebRTC.** Telnyx cobra US$ 0,002/min pela perna browser explicitamente. No Twilio, confirme (pergunta na lista).
6. **IOF + spread cambial** em qualquer provedor USD.

---

## 5. Ranking para ESTE caso de uso

Critérios ponderados: **(a) viabilidade de revenda multi-conta via API**, **(b) WebRTC embutível na sua UI**, **(c) previsibilidade e transparência de custo**, **(d) atrito regulatório/cambial no Brasil**.

### 🥇 1º — Zenvia Voice (ex-TotalVoice)

**Por quê:** é o único provedor pesquisado cuja documentação **descreve explicitamente revenda como caso de uso suportado**. O recurso "Conta Filha" (`POST/GET/PUT/DELETE /conta` + `GET /conta/relatorio`) existe justamente para *"integrações de sistemas, revenda de serviços e uso de funções de telefonia por terceiros"*, com hierarquia conta-pai → contas-filhas. Isso mapeia 1:1 no seu modelo (1 subconta por workspace).

O webphone `tipo=hidden` é o encaixe técnico ideal: você injeta um `<script>`, ele cria um iframe **sem interface**, e você dirige tudo por `postMessage` — recebendo `chegandoChamada`, `status`, `chamada_id`. Ou seja, **a UI do softphone é 100% sua**, o que é exatamente o que um CRM quer. Ramais por usuário via API, webhooks para todo evento de chamada, `GET /chamada/{id}/gravacao` para a gravação, `GET /did` para números. Fatura em BRL, sem exposição cambial.

**Contra:** **nenhum preço de voz PSTN é público.** Todo o caso comercial depende da negociação. Também é preciso confirmar se ainda existe bina dinâmica e se a Zenvia (empresa de capital aberto, com foco atual em Customer Cloud) ainda vende a plataforma de voz como CPaaS puro ou está empurrando o pacote SaaS.

**Veredito:** melhor arquitetura para o seu modelo. **Vá para a mesa com a tabela da seção 4.3 na mão.**

---

### 🥈 2º — Telnyx

**Por quê:** tecnicamente é o CPaaS mais bem desenhado para quem é plataforma. **Managed Accounts** é revenda de verdade: subcontas **herdam o pricing da conta-mãe**, ganham automaticamente as tarifas melhores dos contratos com compromisso, e têm **saldo, meio de pagamento e faturas próprios** — permitindo até faturar o cliente direto se você quiser, ou consolidar. O SDK `@telnyx/webrtc` é open source, tem versão React, autentica por JWT (ideal para emitir credencial efêmera por usuário sem expor senha SIP) e expõe métricas de qualidade de chamada. Gravação a US$ 0,002/min com **armazenamento grátis** — vantagem real sobre o Twilio, que cobra storage após 10.000 min/mês. DID BR mais barato que o Twilio (US$ 3,00 vs US$ 4,25).

**Contra:** três atritos concretos. **(1)** O minuto celular BR **não é público** — você não consegue modelar margem sem falar com vendas. **(2)** Managed Accounts é **limited release**: exige aprovação manual do comercial + verificação L2, então **não é self-service e pode simplesmente não ser liberado para você**. **(3)** A própria página de regulação BR do Telnyx diz *"Information is coming soon"*, o que é um sinal de imaturidade no mercado brasileiro. Some faturamento em USD + IOF.

**Veredito:** melhor stack técnico. Risco = acesso comercial e cobertura BR. **Descubra cedo se liberam Managed Accounts para você — se não liberarem, o Telnyx cai fora inteiro.**

---

### 🥉 3º — API4COM

**Por quê está no pódio:** é o único que entrega, **prontos e em português**, os três itens que dão mais trabalho de construir: **bina dinâmica por DDD** (você não precisa comprar 67 DIDs), **webphone WebRTC** funcional (Kazoo lib, SIP + credencial por ramal em domínio próprio), e **webhook com CDR autoritativo** — o payload de `channel-hangup` já traz duração, timestamps, causa do hangup, **URL da gravação** e sua metadata de volta, que é literalmente o que você precisa para bilhetar o workspace. Fatura em BRL via Asaas (PIX/boleto). É o menor tempo até o primeiro minuto faturado.

**Por que não é 1º:** o modelo comercial anda **na direção oposta da sua**. A empresa está **matando o pay-as-you-go** para vender assinatura por usuário — e revenda de minutos precisa de atacado por minuto. Não há **API de subcontas documentada**, então multi-tenancy provavelmente vira "uma conta API4COM por workspace", gerida por fora. A R$ 0,38 de tabela sua margem é **zero**. E há uma reclamação pública de cobrança quase 2× acima do anunciado.

**Veredito:** melhor DX brasileira, pior modelo comercial para revenda. **Só faz sentido com contrato de atacado por minuto negociado e tabela anexa ao contrato.**

---

### Menções e descartes

- **Nvoip** — coringa de preço (piso anunciado R$ 0,05/min). **Vale cotar mesmo estando fora do pódio**, mas a doc pública é fraca demais para decidir por ela.
- **Directcall** — a consulta de portabilidade/CSP em ≤600ms é um diferencial real (roteia celular vs fixo sem errar tarifa). Sem API de subcontas documentada.
- **55PBX** — arredondamento para minuto cheio + credenciais de API liberadas manualmente pelo suporte inviabilizam provisionamento automático de workspace.
- **Twilio** — o mais transparente e maduro, mas a matemática **não fecha**: R$ 0,3715/min de custo contra R$ 0,38 de venda é 2,2% antes de IOF. Só entra se você subir o preço ao cliente final ou negociar desconto por volume.
- **Plivo** — ❌ **descartado**: não termina chamada em celular brasileiro.
- **Vonage / Infobip / SignalWire / Vono** — sem preço BR público e/ou sem cobertura BR publicada. Fora.

---

## 6. Perguntas exatas para o comercial dos 3 finalistas

### 6.1 Zenvia Voice

**Preço**
1. Qual a tarifa por minuto para **celular** e para **fixo** no Brasil, hoje, na conta pai, em BRL?
2. Qual o **incremento de tarifação** — por segundo, 6/6, ou minuto cheio? Existe cobrança mínima por chamada? Chamada não atendida ou de 3 segundos é tarifada?
3. Existe **tabela de atacado / parceiro** para quem compra volume e revende? A partir de que volume mensal? **Preciso chegar em R$ 0,22/min ou menos para celular** — isso é possível e a que volume?
4. Quanto custa o **DID fixo brasileiro por mês**, e a ativação? Tem preço diferente por DDD?
5. **Gravação:** o armazenamento é cobrado à parte? Qual o período de retenção incluído e o custo por mês depois disso?

**Contas Filhas / multi-tenant**
6. Como habilito minha conta como **conta pai**? É automático ou passa por aprovação?
7. Há **limite de contas filhas**? Qual?
8. As contas filhas **herdam minha tabela de preço** ou têm tabela própria? Se eu negociar desconto por volume, o volume **agrega** entre todas as filhas?
9. O saldo é **único na conta pai** ou cada filha tem saldo próprio? Consigo bilhetar cada filha separadamente pela API (`GET /conta/relatorio` traz consumo por conta)?
10. Consigo **criar ramal e DID dentro da conta filha** 100% via API, sem intervenção humana de vocês?

**Técnico**
11. O webphone `tipo=hidden` tem **SLA e versionamento**? Vocês já quebraram o contrato de `postMessage` em alguma atualização?
12. Quantas **sessões WebRTC simultâneas** por ramal e por conta são suportadas?
13. Existe evento de **`ringing`** (chamando) no webhook, ou só atendida/encerrada? Preciso mostrar estado "chamando" na UI.
14. Qual é a **fonte autoritativa de duração para faturamento** — o webhook, o `GET /chamada/{id}`, ou o relatório? Há divergência conhecida entre eles?
15. Vocês oferecem **bina dinâmica por DDD**? Se sim, qual o custo? Se não, posso rotacionar caller ID entre DIDs meus por API?
16. Qual a política de **retry/assinatura dos webhooks**? Vocês assinam o payload (HMAC)?

**Comercial/risco**
17. A plataforma de Voz (ex-TotalVoice) continua sendo vendida como CPaaS standalone, ou está sendo absorvida no Customer Cloud? **Qual o roadmap de descontinuação?**
18. Qual o **aviso prévio contratual** para reajuste de tarifa?
19. Emitem NF-e por conta filha ou só consolidada na conta pai?

---

### 6.2 Telnyx

**Bloqueador — resolva primeiro**
1. **Vocês liberam Managed Accounts para minha conta?** Quais são exatamente os critérios de qualificação e o que envolve a verificação L2? Qual o prazo?
2. Se **não** liberarem Managed Accounts, existe outro caminho suportado para multi-tenancy com isolamento de billing?

**Preço**
3. Qual a tarifa de terminação para **celular brasileiro** e para **fixo brasileiro**, em USD/min? (Não está pública — preciso do rate sheet BR.)
4. Essa tarifa é **somada** à taxa de plataforma de US$ 0,002/min do Voice API **e** aos US$ 0,002/min da perna WebRTC? **Confirme o custo total de uma chamada browser→celular BR de 1 minuto, somando todas as pernas.**
5. Qual o **incremento de tarifação** para o Brasil — 1/1, 6/6, 30/30? Cobrança mínima?
6. A partir de que **compromisso mensal** vocês dão desconto, e qual o desconto na terminação BR? **Preciso de US$ 0,042/min ou menos no total.**
7. DID BR: US$ 3,00/mês é o piso — qual o preço por DDD nas capitais que eu preciso? Tem taxa de setup?

**Managed Accounts**
8. As Managed Accounts **herdam automaticamente** meu preço com compromisso, incluindo a terminação BR negociada? (A doc diz que sim — confirme por escrito.)
9. Cada Managed Account tem fatura própria — consigo **eu mesmo definir o markup** que a subconta paga, ou ela vê o meu custo?
10. Consigo criar Managed Account, comprar DID nela e emitir credencial SIP **100% via API**, sem ticket?
11. Managed Accounts têm **limite de quantidade**?

**Técnico**
12. O `@telnyx/webrtc` suporta **JWT efêmero por usuário**? Qual o TTL e como faço rotação?
13. Os webhooks de Call Control cobrem `call.initiated`, `call.ringing`, `call.answered`, `call.hangup`? O evento de hangup traz **duração faturável** ou preciso consultar o CDR à parte?
14. Gravação: US$ 0,002/min com storage grátis — **por quanto tempo** o arquivo fica disponível e a URL é autenticada/expirável?
15. **Caller ID:** posso setar como bina qualquer DID que eu possua na conta-mãe, mesmo discando por uma Managed Account? Dá para fazer **bina dinâmica por DDD** sem verificação por chamada?

**Regulatório**
16. A página de regulação BR de vocês diz *"Information is coming soon"*. **Quais são exatamente os requisitos hoje para eu comprar DID brasileiro?** CNPJ? Endereço no BR? Quanto tempo leva a aprovação?
17. Meus **clientes finais** precisam de documentação própria, ou o meu CNPJ cobre todas as Managed Accounts?
18. Vocês têm **presença/interconexão local no Brasil** ou a chamada sai internacional? Qual a latência e o MOS típicos em BR?

---

### 6.3 API4COM

**Bloqueador — resolva primeiro**
1. **Vocês vão mesmo descontinuar o pay-as-you-go?** Qual a data? O blog fala em 6 meses de aviso, sem data definida. **Preciso disso por escrito no contrato.**
2. Vocês têm **contrato de atacado / revenda por minuto** para quem é plataforma SaaS e revende para os próprios clientes? Se não, esse contrato pode existir?

**Preço**
3. Qual é a tarifa **atual** por minuto para celular e fixo no Brasil, depois dos reajustes de 01/08/2025 e 16/09/2025? **Me mandem a tabela vigente em PDF.**
4. **Preciso de R$ 0,22/min ou menos para celular.** A que volume mensal vocês chegam nesse preço? Qual é a escada de desconto por 1.000 minutos?
5. Qual o **incremento de tarifação**? Confirmem: chamadas de até 3 segundos são tarifadas desde ago/2025 — como isso é cobrado exatamente?
6. **Há uma reclamação pública alegando cobrança de ~R$ 0,726/min contra tabela anunciada de R$ 0,38/min.** O que aconteceu e o que mudou para que não se repita? Aceitam cláusula de **reconciliação CDR × fatura** com crédito automático em caso de divergência?
7. Qual o preço de **DID brasileiro por mês** e de ativação?
8. **Gravação:** armazenamento é cobrado? Qual a retenção inclusa?
9. A home anuncia Negociação a **R$ 149,90/user** e o blog a **R$ 99,90/user**. **Qual é o valor válido hoje?**

**Multi-tenant**
10. Existe **API de subcontas**? Consigo criar contas filhas por API, cada uma com seu domínio SIP e seus ramais, e ver o consumo separado por conta?
11. Se não existir: o caminho é **uma conta API4COM por cliente meu**? Nesse caso, consigo criar conta, domínio SIP, ramais e comprar DID **totalmente por API**, sem intervenção humana? Como fica a **cobrança** — uma fatura por conta ou consolidada em mim?
12. Como funciona o **Portal do Parceiro**? Quais as condições comerciais?

**Técnico**
13. Existe evento de **`ringing`**? A doc só mostra `channel-answer` e `channel-hangup` — preciso do estado "chamando" na UI.
14. O `webhookVersion` está travado em **"1.8"**. Qual a política de versionamento e de aviso de breaking change?
15. A **duração no payload de `channel-hangup` é a duração faturável**? Bate exatamente com a fatura?
16. A **URL da gravação** no webhook expira? É autenticada? Por quanto tempo o áudio fica retido?
17. O webphone é **singleton** (uma instância por usuário). Como isso funciona para um usuário com duas abas do CRM abertas? Existe fallback?
18. Posso usar **meu próprio cliente SIP over WSS** (SIP.js/JsSIP) em vez da lib Kazoo? Qual o endpoint WSS e há restrição de codec/ICE?
19. **Bina dinâmica:** como é cobrada? Preciso possuir DIDs em cada DDD ou vocês fornecem o pool? Existe risco regulatório/Anatel nisso?

---

## 7. Recomendação final

**Não feche nada com base em preço público — não existe preço público que feche.** A margem a R$ 0,38/min só aparece via contrato de atacado.

**Sequência sugerida:**

1. **Antes de qualquer call:** rode a distribuição de **minutos por usuário por mês** nos workspaces atuais do TrinoCRM. Sem esse número você não sabe se plano por usuário (API4COM) é lucro ou prejuízo — o ponto de virada é 526 min/user/mês.
2. **Abra três cotações em paralelo:** Zenvia (Conta Filha), Telnyx (Managed Accounts), API4COM (atacado por minuto). **Peça a mesma coisa aos três: preço de celular BR em BRL para 50k, 200k e 500k minutos/mês.** Coloque Nvoip como quarta cotação de pressão — o piso de R$ 0,05/min anunciado é uma boa alavanca de negociação.
3. **Filtro eliminatório em cada um:** Zenvia → o preço fecha em R$ 0,22? Telnyx → liberam Managed Accounts? API4COM → existe contrato de atacado por minuto que sobreviva ao fim do PAYG?
4. **Reavalie o preço de venda.** R$ 0,38/min é tabela pública de varejo de um concorrente. Ou empacote (minutos + gravação + IA) ou negocie custo que permita vender abaixo disso.
5. **Prova de conceito de 2 semanas** com o vencedor, medindo: divergência CDR × fatura, latência de webhook, taxa de falha do WebRTC em Chrome/Safari, e custo real por minuto útil (não por minuto tarifado).

---

## 8. Índice de fontes

**API4COM:** <https://www.api4com.com/> · <https://www.api4com.com/blog/atualizacao-plano-tarifas> · <https://www.api4com.com/blog/o-que-aprendemos-com-nossos-planos-desde-o-lancamento-e-o-que-muda-a-partir-de-agora> · <https://www.api4com.com/termos-de-uso> · <https://developers.api4com.com/> · <https://developers.api4com.com/integration-own-webphone.html> · <https://developers.api4com.com/integration-api4com-webphone.html> · <https://developers.api4com.com/operations/UserIntegration.overrideUpsert.html> · <https://www.reclameaqui.com.br/api4com-tecnologia-e-servicos/cobranca-indevida-de-valores-divergentes-na-api4con_YwEA3ReMtsW9XhnM/>

**Zenvia / TotalVoice:** <https://totalvoice.github.io/totalvoice-docs/> · <https://zenvia.com/blog/como-integrar-seu-sistema-com-o-webphone/> · <https://voice-app.zenvia.com/doc/> · <https://zenvia.com/precos?totalvoice-preco=#product-voz> · <https://zenvia.com/termos/plataforma-voz/> · <https://www.totalvoice.com.br/webhooks/> · <https://devs.zenvia.com/voz/>

**Nvoip:** <https://www.nvoip.com.br/en/rates/> · <https://www.nvoip.com.br/en/virtual-number/> · <https://www.nvoip.com.br/en/api-en/> · <https://github.com/Nvoip/nvoip-integrationAPI> · <https://www.nvoip.com.br/blog/voip/>

**Directcall:** <https://directcall.com.br/produto/api/> · <https://directcall.com.br/produto/api/funcionalidades/> · <https://directcall.com.br/produto/api/como-funciona/> · <https://directcall.com.br/produtos/3cx-ramal-ip/> · <http://directcall.com.br/produto/telefone-virtual/>

**55PBX:** <https://www.55pbx.com/pabx-virtual/plano> · <https://api-55pbx.readme.io/> · <https://suporte.55pbx.com/support/solutions/articles/151000092914--tipos-de-tarifac%C3%A3o> · <https://suporte.55pbx.com/support/solutions/articles/151000180038-guia-de-habilitac%C3%A3o-de-tokens-para-integrac%C3%A3o-com-a-api-55pbx>

**Twilio:** <https://www.twilio.com/en-us/voice/pricing/br> · <https://www.twilio.com/docs/iam/api/subaccounts> · <https://www.twilio.com/docs/voice/sdks/javascript> · <https://www.twilio.com/docs/voice/sdks/javascript/twiliodevice> · <https://www.twilio.com/en-us/guidelines/br/regulatory> · <https://support.twilio.com/hc/en-us/articles/8338625205147-How-to-Submit-a-Regulatory-Bundle-for-Phone-Number-Regulatory-Compliance> · <https://support.twilio.com/hc/en-us/articles/223132527-How-Much-Does-It-Cost-to-Record-a-Call> · <https://support.twilio.com/hc/en-us/articles/223179848-Using-a-non-Twilio-number-as-the-caller-ID-for-outgoing-calls>

**Telnyx:** <https://telnyx.com/pricing/call-control> · <https://telnyx.com/pricing/voice-api> · <https://telnyx.com/pricing/elastic-sip> · <https://telnyx.com/phone-numbers/brazil> · <https://developers.telnyx.com/docs/account/managed-accounts> · <https://telnyx.com/release-notes/managed-accounts> · <https://developers.telnyx.com/api/managed-accounts/enable-managed-account> · <https://developers.telnyx.com/development/webrtc> · <https://developers.telnyx.com/docs/voice/webrtc/reactsdk> · <https://www.npmjs.com/package/@telnyx/webrtc> · <https://github.com/team-telnyx/webrtc>

**Plivo:** <https://www.plivo.com/voice/pricing/br/> · <https://www.plivo.com/sip-trunking/pricing/br/>

**Outros:** <https://www.vonage.com/communications-apis/voice/pricing/> · <https://api.support.vonage.com/hc/en-us/articles/204015203-How-does-voice-pricing-work-for-inbound-and-outbound-calls> · <https://www.infobip.com/voice/pricing> · <https://www.infobip.com/docs/voice-and-video/calls> · <https://signalwire.com/pricing> · <https://grupovono.com.br/>

**Secundárias (baixa confiança):** <https://www.ringlyn.com/blog/sip-trunk-pricing-2026-comparison/> (⚠️ contradiz a tabela oficial do Twilio — não usar) · <https://www.falemaisvoip.com.br/blog/operadora-voip-mais-barata/> · <https://www.getapp.com/customer-service-support-software/a/55pbx/> · <https://scinova.com.br/total-voice-startup-que-se-reinventou-para-crescer-seis-vezes-em-um-ano/> (2018) · <https://www.minhaoperadora.com.br/2022/04/vono-telecom-o-que-e-numero-virtual-e-como-adquirir-um.html> (2022)
