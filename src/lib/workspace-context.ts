import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// No "use client" here on purpose — this file is imported from both server
// route handlers and the client WorkspaceProvider (src/lib/workspace.tsx). A
// "use client" directive tags the whole module as client-only, which breaks
// any server import of getWorkspaceContext (this is exactly what happened:
// POST /api/convites 500'd with "getWorkspaceContext is on the client").

export type Role = "admin" | "gerente" | "vendedor";

export interface WorkspaceInfo {
  workspaceId: string;
  role: Role;
  userId: string;
}

/**
 * Who is this request, and which workspace/role do they have. Pass the
 * request's own Supabase client (route handler, server component,
 * middleware — whichever cookie context is live there).
 */
export async function getWorkspaceContext(
  supabase: SupabaseClient<Database>
): Promise<WorkspaceInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("member_user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  return {
    workspaceId: member.workspace_id,
    role: member.role as Role,
    userId: user.id,
  };
}
