"use client";

import type { Database } from "@/lib/supabase/database.types";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmState, CrmNotification } from "@/lib/crm-types";

export function useRealtimeNotifications(
  userId: string | null,
  supabase: SupabaseClient<Database>,
  setState: React.Dispatch<React.SetStateAction<CrmState>>,
) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime:notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const newNotif: CrmNotification = {
            id: payload.new.id,
            userId: payload.new.user_id,
            type: payload.new.type,
            title: payload.new.title,
            subtext: payload.new.subtext ?? "",
            href: payload.new.href,
            read: payload.new.read,
            createdAt: payload.new.created_at,
          };

          setState((prev) => {
            if (prev.notifications.some((n) => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev.notifications];
            localStorage.setItem("crm_notifications", JSON.stringify(updated));
            return { ...prev, notifications: updated };
          });

          window.dispatchEvent(new CustomEvent("new-notification", { detail: newNotif }));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase, setState]);
}
