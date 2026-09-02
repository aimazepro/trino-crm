// src/app/api/admin/accounts/[id]/route.ts
//
// Bloquear/desbloquear uma CONTA (auth.users), não um workspace -- cobre o
// caso de conta órfã (sem workspace) e o caso de bloquear um usuário
// específico sem mexer no workspace inteiro. Usa o ban nativo do GoTrue:
// banned_until no futuro faz getUser() (chamado em todo request por
// src/proxy.ts) parar de devolver o usuário, cortando acesso na próxima
// request -- mesmo efeito prático do corte por workspace suspenso, sem
// precisar duplicar lógica no proxy.
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";
import { logPlatformAction } from "@/lib/platform-audit";

export const dynamic = "force-dynamic";

// ~100 anos: GoTrue não tem um "banido para sempre" literal, só duration.
// "none" desfaz o ban (é o valor mágico que a API aceita para isso).
const BAN_FOREVER = "876000h";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // "block", não requirePlatformAdmin puro: bloquear/desbloquear conta é a
  // mesma habilidade de suspender workspace, e o papel 'billing' não a tem.
  const auth = await requirePlatformAbility(request, "block");
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

  const { data: targetUser } = await admin.auth.admin.getUserById(id);
  const logged = await logPlatformAction(auth.ctx, {
    action: body.blocked ? "account.block" : "account.unblock",
    targetType: "account",
    targetId: id,
    targetLabel: targetUser?.user?.email ?? null,
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: body.blocked ? BAN_FOREVER : "none",
  });
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  console.log(
    `[admin] conta ${id} ${body.blocked ? "bloqueada" : "desbloqueada"} por ${auth.ctx.via === "session" ? auth.ctx.email : "token"}`
  );

  return apiSuccess({ id, blocked: body.blocked });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAbility(request, "hard_delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = adminClient();

  const { data: target } = await admin.auth.admin.getUserById(id);
  const email = target?.user?.email;
  if (!email) return apiError("NOT_FOUND", "Conta não encontrada", 404);

  // Trava 2: digitação (o e-mail, aqui).
  const confirm = new URL(request.url).searchParams.get("confirm");
  if (!confirm || confirm.toLowerCase() !== email.toLowerCase()) {
    return apiError("CONFIRMATION_REQUIRED", "confirm precisa ser exatamente o e-mail da conta", 400);
  }

  // Trava 4: dono de workspace ativo não sai como "conta". Apagar essa
  // linha cascatearia o workspace inteiro sem que ninguém tivesse decidido
  // apagar o workspace -- que é exatamente o acidente de §8.1.
  // Fail-closed: uma checagem de segurança que não conseguiu rodar não é uma
  // checagem que passou.
  const { data: owned, error: ownedErr } = await admin
    .from("workspaces")
    .select("id, name, slug, status")
    .eq("owner_user_id", id)
    .neq("status", "deleted");

  if (ownedErr) {
    return apiError(
      "INTERNAL_ERROR",
      "A verificação de propriedade de workspace não pôde ser concluída e a conta não será apagada para sua proteção",
      500
    );
  }

  if (owned && owned.length > 0) {
    return apiError(
      "OWNS_ACTIVE_WORKSPACE",
      `Esta conta é dona de ${owned.length} workspace(s) ativo(s) (${owned
        .map((w) => w.slug ?? w.name)
        .join(", ")}). Apague o workspace conscientemente ou transfira a posse antes.`,
      409
    );
  }

  // Trava 1 + 3: contagem real do que a conta destrói/orfana, medida agora,
  // e auditada antes de executar. O log tem que dizer o que foi perdido depois
  // que não existe mais. Usa a RPC que separa destruído (cascata) e orphaned.
  const { data: preview, error: previewErr } = await admin.rpc(
    "platform_account_deletion_preview",
    { p_user_id: id }
  );
  if (previewErr) {
    return apiError("INTERNAL_ERROR", previewErr.message, 500);
  }

  const logged = await logPlatformAction(auth.ctx, {
    action: "account.delete_hard",
    targetType: "account",
    targetId: id,
    targetLabel: email,
    metadata: { preview },
  });
  if (!logged.ok) return apiError("INTERNAL_ERROR", logged.message, 500);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({ id, deleted: "hard", preview });
}
