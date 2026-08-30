import { requirePlatformAbility, adminClient } from "@/lib/platform-admin-server";
import { apiError, apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAbility(request, "read_aggregates");
  if (!auth.ok) return auth.response;

  const { data, error } = await adminClient().rpc("platform_dashboard_stats");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return apiSuccess(data);
}
