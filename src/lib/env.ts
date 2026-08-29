// Fase 0 item 3: valida as env vars obrigatórias uma vez, no boot do
// processo Node (chamado por src/instrumentation.ts) -- em vez de deixar
// cada rota descobrir que falta uma var só quando alguém bate nela em
// produção. Antes disso as ~40 call sites de `process.env.X!` espalhadas
// pelo código (ver docs/BACKLOG.md item "Security headers"/".env.example")
// só quebravam em request time, com `TypeError: ... is not a function`
// (Supabase client construído com url `undefined`) em vez de um erro claro
// dizendo qual var falta.
//
// Server-only. Não importar de código client-side.

const REQUIRED_SERVER_VARS = [
  // Supabase -- usado em praticamente toda rota (~40 call sites com `!`).
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  // Criptografia dos tokens OAuth salvos no banco (Gmail, Google Calendar).
  "OAUTH_ENCRYPTION_KEY",
  // Gmail: OAuth de envio/sync de e-mail, sem fallback no código.
  "GMAIL_OAUTH_CLIENT_ID",
  "GMAIL_OAUTH_CLIENT_SECRET",
  // WhatsApp via Evolution API.
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  // Autentica os 5 cron jobs (pg_cron -> Vercel). Sem essa var as filas de
  // automação ficam paradas em silêncio -- fail closed, mas só se percebe
  // olhando log de cron. Ver [[trino-crm-fase0-hardening-started]].
  "AUTOMATION_DISPATCH_SECRET",
  // Painel admin da plataforma (super-admin): allowlist de e-mail e o bearer
  // token que scripts/curl usam pra chamar /api/admin/* sem sessão de navegador.
  "PLATFORM_ADMIN_EMAILS",
  "PLATFORM_ADMIN_API_TOKEN",
] as const;

// Têm fallback ou uso condicional no código hoje -- documentadas para quem
// for configurar um ambiente novo, mas não derrubam o boot se faltarem.
const OPTIONAL_SERVER_VARS = [
  "GOOGLE_CALENDAR_OAUTH_CLIENT_ID", // cai para GMAIL_OAUTH_CLIENT_ID
  "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET", // cai para GMAIL_OAUTH_CLIENT_SECRET
  "GOOGLE_CALENDAR_REDIRECT_URI", // cai para NEXT_PUBLIC_APP_URL + path fixo
  "CRON_SECRET", // api/cron/calendar-pull -- rota existe, ainda não ligada no pg_cron (item 4 da Fase 0)
  "WHATSAPP_WEBHOOK_BASE_URL", // cai para NEXT_PUBLIC_APP_URL
  "NEXT_PUBLIC_APP_URL", // tem fallback hardcoded para localhost:3000 em alguns call sites
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_SERVER_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Env vars obrigatórias faltando: ${missing.join(", ")}. Ver .env.example na raiz do projeto.`
    );
  }
}

// Exportado só para o próprio .env.example/testes conferirem a lista sem
// duplicá-la.
export const ENV_VAR_NAMES = {
  required: REQUIRED_SERVER_VARS,
  optional: OPTIONAL_SERVER_VARS,
};
