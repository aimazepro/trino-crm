"use client";

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CrmState, Pipeline, Deal, Contact, Company,
  Label, Appointment, Activity, CrmNotification,
} from "@/lib/crm-types";
import { loadCrmData } from "@/lib/crm-loader";
import { useCrmMutations } from "@/hooks/use-crm-mutations";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { useWorkspaceInfo, useWorkspaceLoading } from "@/lib/workspace";

interface CrmContextType {
  state: CrmState;
  loading: boolean;
  moveDeal: (dealId: string, newStageId: string) => void;
  moveDealToPipeline: (dealId: string, newPipelineId: string, newStageId: string) => void;
  markDealStatus: (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string, reasonId?: string | null, reasonNote?: string) => void;
  updateDealFields: (dealId: string, fields: Partial<Deal>) => void;
  addDealNote: (dealId: string, content: string) => void;
  deleteDealNote: (dealId: string, noteId: string) => void;
  updateDealNote: (dealId: string, noteId: string, content: string) => void;
  addDealHistory: (dealId: string, description: string, subtext: string) => void;
  addDeal: (deal: Deal) => Promise<string | null>;
  deleteDeal: (dealId: string, reason: string, note?: string) => void;
  restoreDeal: (dealId: string) => void;
  duplicateDeal: (dealId: string) => Promise<string | null>;
  mergeDeals: (survivorId: string, loserId: string, resultFields: Partial<Deal>) => Promise<void>;
  addPipeline: (pipeline: Pipeline) => Promise<string | null>;
  deletePipeline: (pipelineId: string) => void;
  updatePipeline: (pipelineId: string, fields: Partial<Pipeline>) => void;
  reorderPipelines: (orderedIds: string[]) => void;
  updateContact: (contactId: string, fields: Partial<Contact>) => void;
  addContact: (contact: Contact) => Promise<string | null>;
  deleteContact: (contactId: string) => void;
  updateCompany: (companyId: string, fields: Partial<Company>) => void;
  addCompany: (company: Company) => Promise<string | null>;
  deleteCompany: (companyId: string) => void;
  addLabel: (label: Label) => Promise<string | null>;
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt" | "status">) => void;
  updateAppointment: (appointmentId: string, fields: Partial<Appointment>) => void;
  deleteAppointment: (appointmentId: string) => void;
  addActivity: (activity: Omit<Activity, "id" | "createdAt" | "attachments" | "completed"> & { completed?: boolean }) => void;
  updateActivity: (activityId: string, fields: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  addActivityAttachment: (activityId: string, file: File) => Promise<void>;
  deleteActivityAttachment: (attachmentId: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmState>({ pipelines: [], deals: [], contacts: [], companies: [], labels: [], notifications: [], orphanActivities: [] });
  const [loading, setLoading] = useState(true);
  const workspace = useWorkspaceInfo();
  const workspaceLoading = useWorkspaceLoading();
  const userId = workspace?.userId ?? null;
  const workspaceId = workspace?.workspaceId ?? null;
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (workspaceLoading) return;
    async function load() {
      if (!userId) { setLoading(false); return; }
      const data = await loadCrmData(supabase, userId);
      setState(data);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceLoading, userId]);

  const mutations = useCrmMutations({ state, setState, userId, workspaceId, supabase });
  useRealtimeNotifications(userId, supabase, setState);

  // Real-time check for due activities (triggers notification at exact date & time in real-time without needing page refresh)
  useEffect(() => {
    if (!userId || !workspaceId || loading) return;

    const checkDueActivities = async () => {
      const now = new Date();
      let notifiedSet: Set<string>;
      try {
        notifiedSet = new Set(JSON.parse(localStorage.getItem("crm_notified_activities") || "[]"));
      } catch {
        notifiedSet = new Set();
      }

      // Atividade órfã (atribuída a este usuário num negócio de OUTRO dono)
      // não mora em nenhum deal de state.deals -- ela fica na lista à parte
      // orphanActivities. O laço antigo varria só state.deals, então a pessoa
      // nunca era avisada de uma tarefa dela vencer. O dealId sai da própria
      // atividade para a chave de deduplicação abaixo continuar idêntica à
      // que já está no localStorage; mudá-la re-notificaria todo o histórico.
      const aVarrer = [
        ...state.deals.flatMap((deal) =>
          (deal.activities || []).map((activity) => ({ dealId: deal.id, activity })),
        ),
        ...state.orphanActivities.map((activity) => ({ dealId: activity.dealId, activity })),
      ];

      {
        for (const { dealId, activity } of aVarrer) {
          if (activity.completed) continue;
          const actDate = new Date(activity.date);
          if (actDate.getTime() <= now.getTime()) {
            // Keyed by stable fields (not activity.id — it starts as a temp client id
            // like `act_${Date.now()}` and gets swapped for the real DB id after insert
            // resolves, which produced a second, different key and a duplicate notification).
            const notifKey = `act_notif_${dealId}_${activity.title}_${activity.type}_${activity.date}`;
            if (!notifiedSet.has(notifKey)) {
              notifiedSet.add(notifKey);
              // Persist immediately (not batched at the end of the loop) so an overlapping
              // invocation — e.g. a slow insert on a previous tick still in flight — reads
              // this key and doesn't re-notify the same activity.
              localStorage.setItem("crm_notified_activities", JSON.stringify(Array.from(notifiedSet)));

              const isToday = actDate.toDateString() === now.toDateString();
              let subtext = "";
              if (isToday) {
                subtext = `Hoje às ${actDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
              } else {
                const diffDays = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  subtext = `${diffDays} ${diffDays === 1 ? "dia" : "dias"} atrasado`;
                } else {
                  subtext = `${actDate.toLocaleDateString("pt-BR")} às ${actDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                }
              }

              let newNotif: CrmNotification;

              try {
                const { data, error } = await supabase.from("notifications").insert({
                  user_id: userId,
                  workspace_id: workspaceId,
                  type: "activity",
                  title: activity.title,
                  subtext,
                  href: "/atividades",
                  read: false,
                }).select().single();

                if (data && !error) {
                  newNotif = {
                    id: data.id,
                    userId: data.user_id,
                    type: data.type as CrmNotification["type"],
                    title: data.title,
                    subtext: data.subtext ?? "",
                    href: data.href,
                    read: data.read,
                    createdAt: data.created_at,
                  };
                } else {
                  newNotif = {
                    id: `local_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    userId,
                    type: "activity",
                    title: activity.title,
                    subtext,
                    href: "/atividades",
                    read: false,
                    createdAt: new Date().toISOString(),
                  };
                }
              } catch {
                newNotif = {
                  id: `local_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  userId,
                  type: "activity",
                  title: activity.title,
                  subtext,
                  href: "/atividades",
                  read: false,
                  createdAt: new Date().toISOString(),
                };
              }

              // Immediately update state in real-time
              setState(prev => {
                if (prev.notifications.some(n => n.id === newNotif.id)) return prev;
                const updated = [newNotif, ...prev.notifications];
                localStorage.setItem("crm_notifications", JSON.stringify(updated));
                return { ...prev, notifications: updated };
              });

              // Instantly dispatch real-time toast banner in Topbar
              window.dispatchEvent(new CustomEvent("new-notification", { detail: newNotif }));
            }
          }
        }
      }
    };

    checkDueActivities();
    const interval = setInterval(checkDueActivities, 5000); // Check every 5s for real-time delivery
    return () => clearInterval(interval);
    // state.orphanActivities entra aqui junto com state.deals: sem ela o
    // setInterval fecharia sobre a lista do render em que o efeito nasceu, e
    // uma órfã que chegasse depois nunca seria varrida. Hoje as duas mudam no
    // mesmo setState do load(), mas depender disso é frágil.
  }, [userId, workspaceId, loading, state.deals, state.orphanActivities, supabase]);

  const ctxValue = useMemo(() => ({
    state, loading, ...mutations,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, loading]);

  return (
    <CrmContext.Provider value={ctxValue}>
      {children}
    </CrmContext.Provider>
  );
}
