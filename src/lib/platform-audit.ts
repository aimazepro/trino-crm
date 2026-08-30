// src/lib/platform-audit.ts
//
// Toda escrita do painel passa por aqui ANTES de executar a ação. Se a
// gravação falhar, a ação não acontece -- uma operação sem rastro é pior do
// que uma operação que não aconteceu, e o console.log da Vercel (que era o
// "log" até agora) expira.
//
// Server-only: usa service-role.
import { adminClient, type PlatformAdminContext } from "@/lib/platform-admin-server";
import type { Json } from "@/lib/supabase/database.types";

export interface AuditEntry {
  /** Verbo pontuado: 'workspace.suspend', 'account.block', 'impersonate.start'. */
  action: string;
  targetType?: "workspace" | "account" | "operator" | null;
  targetId?: string | null;
  /** Nome/e-mail no momento da ação -- o log tem que sobreviver a rename e
   * a delete do alvo. */
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logPlatformAction(
  ctx: PlatformAdminContext,
  entry: AuditEntry
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = adminClient();
  const { error } = await admin.from("platform_audit_log").insert({
    actor_email: ctx.email,
    actor_role: ctx.role,
    actor_via: ctx.via,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    // Record<string, unknown> não é estruturalmente um Json (unknown não é
    // atribuível a Json) -- o valor já é serializável de fato, o cast só
    // contorna essa aspereza do tipo gerado.
    metadata: (entry.metadata ?? null) as Json | null,
  });

  if (error) return { ok: false, message: `Falha ao gravar auditoria: ${error.message}` };

  // last_seen_at = última AÇÃO registrada, não última visita: atualizar a
  // cada page view custaria um write por navegação sem contar nada útil.
  if (ctx.userId) {
    await admin
      .from("platform_admins")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", ctx.userId);
  }

  return { ok: true };
}
