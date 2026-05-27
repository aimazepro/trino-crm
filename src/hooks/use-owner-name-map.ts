"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useOwnerNameMap(): { map: Record<string, string>; names: string[]; selfName: string } {
  const [map, setMap] = useState<Record<string, string>>({});
  const [selfName, setSelfName] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const self = (user.user_metadata?.full_name as string | undefined) || user.email || "Você";
      const next: Record<string, string> = { [user.id]: self };
      const { data } = await supabase
        .from("team_members")
        .select("member_user_id, name, email, owner_user_id, status")
        .or(`owner_user_id.eq.${user.id},member_user_id.eq.${user.id}`)
        .eq("status", "accepted");
      (data ?? []).forEach((m) => {
        if (m.member_user_id) next[m.member_user_id] = m.name || m.email;
      });
      if (!cancelled) {
        setMap(next);
        setSelfName(self);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const names = Object.values(map);
  return { map, names, selfName };
}
