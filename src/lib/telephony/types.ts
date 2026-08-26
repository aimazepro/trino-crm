// Contrato de provedor de telefonia.
//
// Nenhuma rota da aplicacao fala com um provedor especifico. Elas falam com
// esta interface. Trocar de provedor e escrever um arquivo novo em
// ./providers e mudar a coluna `provider` da conta do workspace -- nao e
// reescrever o CRM.

export type ProviderName = "mock" | "api4com";

export type CallStatus =
  | "queued"
  | "ringing"
  | "answered"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "canceled";

export type ExtensionMode = "unlimited" | "per_minute";
export type DialMode = "webphone" | "callback";
export type DestinationType = "mobile" | "landline" | "tollfree" | "international";

export type CallDisposition =
  | "atendeu"
  | "nao_atendeu"
  | "caixa_postal"
  | "numero_errado"
  | "reagendar"
  | "sem_interesse"
  | "ocupado";

/**
 * Evento de chamada ja normalizado. Cada provedor traduz o proprio formato
 * para este, entao o resto do sistema nunca precisa saber de quem veio.
 */
export interface NormalizedCallEvent {
  providerEventId: string;
  providerCallId: string;
  type: "initiated" | "ringing" | "answered" | "completed" | "failed" | "recording_ready";
  occurredAt: string;
  /** So vem em `completed`. E a duracao AUTORITATIVA -- a do CDR, nao a do navegador. */
  durationSeconds?: number;
  status?: CallStatus;
  hangupCause?: string;
  recordingRef?: string;
  raw: unknown;
}

export interface ProvisionAccountInput {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  webhookUrl: string;
  webhookSecret: string;
}

export interface ProvisionAccountResult {
  providerAccountId: string;
  /** Guardado encriptado em telephony_accounts.credentials_encrypted. */
  credentials: Record<string, unknown>;
  callerId?: string;
}

export interface CreateExtensionInput {
  providerAccountId: string;
  credentials: Record<string, unknown>;
  userId: string;
  userName: string | null;
  preferredExtension?: string;
}

export interface CreateExtensionResult {
  credentialId: string;
  extension: string;
  sipUsername: string;
  sipPassword: string;
  sipServer: string;
}

export interface WebphoneToken {
  /** Token efemero. Credencial SIP permanente nunca vai para o navegador. */
  token: string;
  expiresAt: string;
  sipServer: string;
  wsServer?: string;
  extension: string;
}

export interface OriginateInput {
  credentials: Record<string, unknown>;
  providerAccountId: string;
  extension: string;
  sipUsername: string;
  toNumber: string;
  callerId: string | null;
  /** Nossa referencia, ecoada de volta pelo provedor quando ele suporta. */
  callRef: string;
  record: boolean;
  /** Modo callback: numero do celular do vendedor no lugar do ramal. */
  callbackNumber?: string | null;
}

export interface RecordingRef {
  url: string;
  contentType: string;
  expiresAt?: string;
}

export interface TelephonyProvider {
  readonly name: ProviderName;
  /** Se false, a UI pede as credenciais em vez de provisionar sozinha. */
  readonly canSelfProvision: boolean;

  provisionAccount(input: ProvisionAccountInput): Promise<ProvisionAccountResult>;
  createExtension(input: CreateExtensionInput): Promise<CreateExtensionResult>;
  deleteExtension(input: {
    credentials: Record<string, unknown>;
    credentialId: string;
  }): Promise<void>;

  issueWebphoneToken(input: {
    credentials: Record<string, unknown>;
    extension: string;
    sipUsername: string;
    sipPassword: string;
    sipServer: string;
  }): Promise<WebphoneToken>;

  originateCall(input: OriginateInput): Promise<{ providerCallId: string }>;
  hangupCall(input: {
    credentials: Record<string, unknown>;
    providerCallId: string;
  }): Promise<void>;

  fetchRecording(input: {
    credentials: Record<string, unknown>;
    providerCallId: string;
  }): Promise<RecordingRef | null>;

  /** Verifica a assinatura do webhook. Falhou = 401, sem excecao. */
  verifyWebhook(headers: Headers, rawBody: string, secret: string): boolean;
  parseWebhook(body: unknown): NormalizedCallEvent[];
}
