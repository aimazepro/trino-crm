// Roda uma vez quando uma instância do server Next.js inicia (cold start
// na Vercel, `next dev`/`next start` localmente) -- antes de aceitar
// qualquer request. Ver src/lib/env.ts (Fase 0 item 3).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
