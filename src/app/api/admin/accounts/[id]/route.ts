// src/app/api/admin/accounts/[id]/route.ts
//
// Bloquear/desbloquear uma CONTA (auth.users), não um workspace -- cobre o
// caso de conta órfã (sem workspace) e o caso de bloquear um usuário
// específico sem mexer no workspace inteiro. Usa o ban nativo do GoTrue:
// banned_until no futuro faz getUser() (chamado em todo request por
// src/proxy.ts) parar de devolver o usuário, cortando acesso na próxima
// request -- mesmo efeito prático do corte por workspace suspenso, sem
// precisar duplicar lógica no proxy.
import { requirePlatformAdmin, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// ~100 anos: GoTrue não tem um "banido para sempre" literal, só duration.
// "none" desfaz o ban (é o valor mágico que a API aceita para isso).
const BAN_FOREVER = "876000h";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { blocked?: boolean };
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo da requisição não é JSON válido", 400);
  }
  if (typeof body.blocked !== "boolean") {
    return apiError("VALIDATION_ERROR", "blocked (boolean) é obrigatório", 400);
  }

  const admin = adminClient();

  // Sem isso, um admin logado via sessão consegue se bloquear sozinho e
  // fica trancado de fora sem ninguém pra reverter (token de API não tem
  // e-mail pra comparar, então essa checagem só existe pra via "session").
  if (auth.ctx.via === "session" && auth.ctx.email) {
    const { data: target } = await admin.auth.admin.getUserById(id);
    if (target?.user?.email?.toLowerCase() === auth.ctx.email.toLowerCase()) {
      return apiError("SELF_BLOCK", "Não é possível bloquear a própria conta", 400);
    }
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: body.blocked ? BAN_FOREVER : "none",
  });
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  console.log(
    `[admin] conta ${id} ${body.blocked ? "bloqueada" : "desbloqueada"} por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ id, blocked: body.blocked });
}
