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
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePlatformAbility(request, "impersonate");
  if (!auth.ok) return auth.response;

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }
  if (!body.userId) return apiError("VALIDATION_ERROR", "userId é obrigatório", 400);

  const admin = adminClient();
  const { data: target } = await admin.auth.admin.getUserById(body.userId);
  const email = target?.user?.email;
  if (!email) return apiError("NOT_FOUND", "Conta não encontrada", 404);

  // Auditoria ANTES de gerar o link: um link gerado é acesso concedido,
  // mesmo que o operador nunca clique nele.
  const logged = await logPlatformAction(auth.ctx, {
    action: "impersonate.start",
    targetType: "account",
    targetId: body.userId,
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
  const crmBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/auth/impersonate", crmBase);
  url.searchParams.set("token_hash", link.properties.hashed_token);
  url.searchParams.set("email", email);

  return apiSuccess({ url: url.toString() });
}
