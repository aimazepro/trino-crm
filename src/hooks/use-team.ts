"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceInfo, useWorkspaceLoading } from "@/lib/workspace";

export type TeamRole = "admin" | "gerente" | "vendedor";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl: string | null;
}

export interface TeamInfo {
  members: TeamMember[];
  map: Record<string, string>;
  avatars: Record<string, string | null>;
  self: TeamMember | null;
  isManager: boolean;
  loading: boolean;
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "V";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Quem está no workspace, para qualquer tela que precise mostrar ou filtrar
 * por pessoa. Substitui useOwnerNameMap, que derivava a lista do próprio
 * usuário logado e por isso escondia todo mundo que ainda não tinha registro
 * atribuído -- um vendedor recém-convidado era invisível no sistema inteiro.
 */
export function useTeam(): TeamInfo {
  const info = useWorkspaceInfo();
  const workspaceLoading = useWorkspaceLoading();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Dois casos de `info` ser null:
    // (a) WorkspaceProvider ainda resolvendo → workspaceLoading=true → esperar
    // (b) WorkspaceProvider resolveu, usuário sem membership aceita → workspaceLoading=false,
    //     info=null → resposta válida, retorna members=[], loading=false
    if (!info && workspaceLoading) return;

    let cancelled = false;

    // Se chegou aqui, ou info é válido, ou é null mas workspace resolveu.
    // Em ambos casos, resolve o time (pode estar vazio).
    if (info) {
      setLoading(true);
      void (async () => {
        const { data } = await supabase
          .from("workspace_members")
          .select("member_user_id, name, email, role, avatar_url")
          .eq("workspace_id", info.workspaceId)
          .eq("status", "accepted");

        if (cancelled) return;

        const list: TeamMember[] = (data ?? [])
          .filter((m) => m.member_user_id)
          .map((m) => ({
            id: m.member_user_id as string,
            name: m.name || m.email,
            email: m.email,
            role: (m.role as TeamRole) ?? "vendedor",
            avatarUrl: m.avatar_url ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        setMembers(list);
        setLoading(false);
      })();
    } else {
      // info é null e workspaceLoading é false → usuário sem membership
      setMembers([]);
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [supabase, info, workspaceLoading]);

  return useMemo(() => {
    const map: Record<string, string> = {};
    const avatars: Record<string, string | null> = {};
    for (const m of members) {
      map[m.id] = m.name;
      avatars[m.id] = m.avatarUrl;
    }
    return {
      members,
      map,
      avatars,
      self: members.find((m) => m.id === info?.userId) ?? null,
      isManager: info?.role === "admin" || info?.role === "gerente",
      loading,
    };
  }, [members, info, loading]);
}
