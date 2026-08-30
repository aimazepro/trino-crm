import { requirePlatformAdmin } from "@/lib/platform-admin-server";
import { apiSuccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return auth.response;
  return apiSuccess({ email: auth.ctx.email, role: auth.ctx.role, via: auth.ctx.via });
}
