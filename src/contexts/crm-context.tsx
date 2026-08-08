"use client";

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CrmState, Pipeline, Deal, Contact, Company,
  Label, Appointment, Activity,
} from "@/lib/crm-types";
import { loadCrmData } from "@/lib/crm-loader";
import { useCrmMutations } from "@/hooks/use-crm-mutations";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

interface CrmContextType {
  state: CrmState;
  loading: boolean;
  moveDeal: (dealId: string, newStageId: string) => void;
  moveDealToPipeline: (dealId: string, newPipelineId: string, newStageId: string) => void;
  markDealStatus: (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => void;
  updateDealFields: (dealId: string, fields: Partial<Deal>) => void;
  addDealNote: (dealId: string, content: string) => void;
  deleteDealNote: (dealId: string, noteId: string) => void;
  updateDealNote: (dealId: string, noteId: string, content: string) => void;
  addDealHistory: (dealId: string, description: string, subtext: string) => void;
  addDeal: (deal: Deal) => Promise<string | null>;
  deleteDeal: (dealId: string) => void;
  addPipeline: (pipeline: Pipeline) => Promise<string | null>;
  deletePipeline: (pipelineId: string) => void;
  updatePipeline: (pipelineId: string, fields: Partial<Pipeline>) => void;
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
  addActivity: (activity: Omit<Activity, "id" | "createdAt" | "completed">) => void;
  updateActivity: (activityId: string, fields: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
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
  const [state, setState] = useState<CrmState>({ pipelines: [], deals: [], contacts: [], companies: [], labels: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const data = await loadCrmData(supabase, user.id);
      setState(data);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutations = useCrmMutations({ state, setState, userId, supabase });
  useRealtimeNotifications(userId, supabase, setState);

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
