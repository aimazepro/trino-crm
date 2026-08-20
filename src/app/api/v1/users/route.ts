import { createAdmin } from "@/lib/whatsapp/connection";
import { authenticateApiRequest, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = createAdmin();
  const auth = await authenticateApiRequest(request, admin, "read_users");
  if (!auth.ok) return auth.response;

  const { data: members, error } = await admin
    .from("workspace_members")
    .select("member_user_id, role, status")
    .eq("workspace_id", auth.ctx.workspaceId)
    .eq("status", "accepted");
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const byId = new Map((authUsers?.users ?? []).map((u) => [u.id, u]));

  const data = (members ?? [])
    .filter((m) => m.member_user_id !== null)
    .map((m) => {
      const u = byId.get(m.member_user_id as string);
      const name = (u?.user_metadata?.full_name as string | undefined) || (u?.user_metadata?.name as string | undefined) || u?.email || null;
      return { id: m.member_user_id as string, name, email: u?.email ?? null, role: m.role };
    });

  return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
}
