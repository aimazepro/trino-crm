import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, null);
  if (!auth.ok) return auth.response;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name, slug")
    .eq("id", auth.ctx.workspaceId)
    .maybeSingle();

  return apiSuccess({
    workspace: { id: auth.ctx.workspaceId, name: workspace?.name ?? null },
    defaultOwnerId: auth.ctx.defaultOwnerId,
    permissions: auth.ctx.permissions,
    rateLimitPerMin: auth.ctx.rateLimitPerMin,
  });
}
