"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWorkspaceContext, type Role, type WorkspaceInfo } from "@/lib/workspace-context";

export type { Role, WorkspaceInfo };

const WorkspaceContext = createContext<{ info: WorkspaceInfo | null; loading: boolean }>({
  info: null,
  loading: true,
});

/** Mount once near the root layout — client components read it via useWorkspace(). */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceContext(supabase).then((result) => {
      if (!cancelled) {
        setInfo(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ info, loading }), [info, loading]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Client-side source of truth for the current workspace/role/user.
 * Throws if called before the workspace is resolved — callers that render
 * while loading is possible should check `useWorkspaceLoading()` first, or
 * gate on CrmProvider's own `loading` (it awaits the same data).
 */
export function useWorkspace(): WorkspaceInfo {
  const { info } = useContext(WorkspaceContext);
  if (!info) throw new Error("useWorkspace called before workspace resolved (or user has no workspace)");
  return info;
}

export function useWorkspaceLoading(): boolean {
  return useContext(WorkspaceContext).loading;
}

/** Non-throwing variant for consumers that manage their own loading gate (e.g. CrmProvider). */
export function useWorkspaceInfo(): WorkspaceInfo | null {
  return useContext(WorkspaceContext).info;
}
