"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "V";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useOwnerNameMap(): {
  map: Record<string, string>;
  avatars: Record<string, string | null>;
  names: string[];
  selfName: string;
  selfId: string;
} {
  const [map, setMap] = useState<Record<string, string>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [selfName, setSelfName] = useState<string>("");
  const [selfId, setSelfId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const self = (user.user_metadata?.full_name as string | undefined) || user.email || "Você";
      const selfAvatar = (user.user_metadata?.avatar_url as string | undefined) || (user.user_metadata?.picture as string | undefined) || null;
      const nextMap: Record<string, string> = { [user.id]: self };
      const nextAvatars: Record<string, string | null> = { [user.id]: selfAvatar };

      const { data } = await supabase
        .from("workspace_members")
        .select("member_user_id, name, email, status")
        .eq("status", "accepted");

      (data ?? []).forEach((m) => {
        if (m.member_user_id) {
          nextMap[m.member_user_id] = m.name || m.email;
        }
      });

      if (!cancelled) {
        setMap(nextMap);
        setAvatars(nextAvatars);
        setSelfName(self);
        setSelfId(user.id);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const names = Object.values(map);
  return { map, avatars, names, selfName, selfId };
}
