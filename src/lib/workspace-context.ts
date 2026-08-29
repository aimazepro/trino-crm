import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { effectiveFeatures, type FeatureKey } from "@/lib/feature-flags";

// No "use client" here on purpose — this file is imported from both server
// route handlers and the client WorkspaceProvider (src/lib/workspace.tsx). A
// "use client" directive tags the whole module as client-only, which breaks
// any server import of getWorkspaceContext (this is exactly what happened:
// POST /api/convites 500'd with "getWorkspaceContext is on the client").
//
// feature-flags.ts (not feature-flags-server.ts) is imported here for the
// same reason: this file is client-bundled too, so it can never pull in
// next/server transitively.

export type Role = "admin" | "gerente" | "vendedor";

export interface WorkspaceInfo {
  workspaceId: string;
  role: Role;
  userId: string;
  features: Record<FeatureKey, boolean>;
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
    .select("workspace_id, role, workspaces(plan, feature_flags)")
    .eq("member_user_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  // Mesma normalização de embed to-one da Task 4: objeto único ou array de
  // um item, dependendo de como o gerador de tipos do Supabase tipou a
  // relação -- não assume um formato só.
  const rawWorkspace = member.workspaces as
    | { plan: string; feature_flags: unknown }
    | { plan: string; feature_flags: unknown }[]
    | null;
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;

  return {
    workspaceId: member.workspace_id,
    role: member.role as Role,
    userId: user.id,
    features: effectiveFeatures(
      workspace?.plan ?? "trial",
      (workspace?.feature_flags as Partial<Record<FeatureKey, boolean>>) ?? null
    ),
  };
}
