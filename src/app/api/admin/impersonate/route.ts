// src/app/api/admin/impersonate/route.ts
//
// Gera um magic link de uso único pro usuário alvo e devolve a URL de
// callback NO HOST DO CRM. O painel abre em aba nova.
//
// RISCO DOCUMENTADO (§11 do spec): a sessão emprestada SOBRESCREVE a sessão
// que o operador tivesse no CRM naquele navegador. Hoje é inofensivo
// (tools@ não usa o CRM), mas continua verdade.
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { logPlatformAction } from "@/lib/platform-audit";
import { apiError, apiSuccess, readOptionalUuid } from "@/lib/api-auth";
import { matchesAdminAllowlist } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePlatformAbility(request, "impersonate");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }

  const uuidCheck = readOptionalUuid(body, "userId");
  if (!uuidCheck.ok) return apiError("VALIDATION_ERROR", uuidCheck.message, 400);
  if (!uuidCheck.value) return apiError("VALIDATION_ERROR", "userId é obrigatório", 400);
  const userId = uuidCheck.value;

  const admin = adminClient();
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const email = target?.user?.email;
  if (!email) return apiError("NOT_FOUND", "Conta não encontrada", 404);

  // Recusa por o ALVO ser conta de operador da plataforma. Sem isso, um
  // operador 'support' -- que tem a habilidade "impersonate" mas NÃO tem
  // "manage_operators" -- podia passar o user_id do 'owner' e ganhar de
  // volta uma sessão de owner completa e válida no próprio navegador via
  // este mesmo endpoint: escalação de privilégio dentro da funcionalidade
  // cujo modelo de ameaça inteiro é "operador vira outra pessoa". As três
  // checagens abaixo têm que valer sobre o ALVO, não sobre quem chama:
  // - linha em platform_admins, INDEPENDENTE do status: um 'suspended'
  //   ainda marca a conta como de operador, não vira conta impersonável só
  //   porque foi suspensa;
  // - e-mail na allowlist de PLATFORM_ADMIN_EMAILS, mesmo sem linha na
  //   tabela -- é a mesma fonte de verdade usada pra resolver quem É
  //   operador (ver getPlatformAdminFromSession);
  // - o próprio chamador, comparando id e (quando os dois existem) e-mail
  //   sem diferenciar maiúscula/minúscula.
  // Não simplifique isto pra "só checa manage_operators" -- o ponto nunca
  // foi a habilidade de quem pede, foi a identidade de quem seria vestido.
  const { data: operatorRow } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const isOperatorAccount = !!operatorRow || matchesAdminAllowlist(email, process.env.PLATFORM_ADMIN_EMAILS);
  const isSelf =
    auth.ctx.userId === userId ||
    (!!auth.ctx.email && email.toLowerCase() === auth.ctx.email.toLowerCase());
  if (isOperatorAccount || isSelf) {
    return apiError("FORBIDDEN", "Não é possível entrar como uma conta de operador da plataforma", 403);
  }

  // Auditoria ANTES de gerar o link: um link gerado é acesso concedido,
  // mesmo que o operador nunca clique nele. Uma requisição recusada acima
  // não é uma ação -- por isso a recusa vem antes da auditoria, não depois.
  const logged = await logPlatformAction(auth.ctx, {
    action: "impersonate.start",
    targetType: "account",
    targetId: userId,
    targetLabel: email,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link?.properties?.hashed_token) {
    return apiError("INTERNAL_ERROR", error?.message ?? "Falha ao gerar link de acesso", 500);
  }

  // O callback mora no host do CRM: é lá que a sessão precisa nascer. O host
  // do painel não pode ser usado aqui -- o cookie é host-only e a sessão
  // ficaria do lado errado.
  //
  // hashed_token viaja em query string de um GET: fica em log de acesso do
  // host e no histórico do navegador de quem clicar. É de uso único --
  // verifyOtp() consome e invalida no primeiro uso --, o que limita o
  // estrago, mas a janela de validade até esse primeiro uso é a
  // configuração global de expiração de OTP do projeto Supabase, não algo
  // que esta rota decide ou controla. É por isso que a auditoria acima roda
  // ANTES de gerar o link: o link em si já é o acesso concedido, esteja ele
  // válido por mais 5 minutos ou por mais 1 hora.
  const crmBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/auth/impersonate", crmBase);
  url.searchParams.set("token_hash", link.properties.hashed_token);
  url.searchParams.set("email", email);

  return apiSuccess({ url: url.toString() });
}
