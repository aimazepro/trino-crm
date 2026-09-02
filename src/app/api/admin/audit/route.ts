// src/app/api/admin/audit/route.ts
import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_customer_data");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  // Math.max(1, ...) além do Math.min: sem ele, ?limit=-5 chegava ao
  // PostgREST como .limit(-5) e ?limit=1.5 passava fracionário adiante.
  const limit = Math.min(Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 100) || 100)), 500);
  const action = url.searchParams.get("action");
  const targetId = url.searchParams.get("targetId");

  let query = adminClient()
    .from("platform_audit_log")
    .select("id, actor_email, actor_role, actor_via, action, target_type, target_id, target_label, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);
  if (targetId) query = query.eq("target_id", targetId);

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess({
    entries: (data ?? []).map((e) => ({
      id: e.id,
      actorEmail: e.actor_email,
      actorRole: e.actor_role,
      actorVia: e.actor_via,
      action: e.action,
      targetType: e.target_type,
      targetId: e.target_id,
      targetLabel: e.target_label,
      metadata: e.metadata,
      createdAt: e.created_at,
    })),
  });
}
