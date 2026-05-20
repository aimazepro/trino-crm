"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CrmState, Pipeline, Deal, Contact, Company, Label, HistoryLog, Note, Appointment, Activity } from "@/lib/crm-types";
import { MOCK_STATE } from "@/lib/crm-mock";

interface CrmContextType {
  state: CrmState;
  
  // Deal Mutations
  moveDeal: (dealId: string, newStageId: string) => void;
  markDealStatus: (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => void;
  updateDealFields: (dealId: string, fields: Partial<Deal>) => void;
  addDealNote: (dealId: string, content: string) => void;
  addDealHistory: (dealId: string, description: string, subtext: string) => void;
  addDeal: (deal: Deal) => void;
  deleteDeal: (dealId: string) => void;
  
  // Pipeline Mutations
  addPipeline: (pipeline: Pipeline) => void;
  deletePipeline: (pipelineId: string) => void;
  updatePipeline: (pipelineId: string, fields: Partial<Pipeline>) => void;
  
  // Global Relations
  updateContact: (contactId: string, fields: Partial<Contact>) => void;
  addContact: (contact: Contact) => void;
  updateCompany: (companyId: string, fields: Partial<Company>) => void;
  addCompany: (company: Company) => void;
  addLabel: (label: Label) => void;
  
  // Advanced Features
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt" | "status">) => void;
  addActivity: (activity: Omit<Activity, "id" | "createdAt" | "completed">) => void;
  updateActivity: (activityId: string, fields: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  
  const [state, setState] = useState<CrmState>(() => {
    // Try to restore from localStorage if exists, else MOCK
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("@trino:crm-state");
        if (saved) {
           const parsed = JSON.parse(saved);
           // Safety Check for New Schema (emails array vs email string)
           if (parsed.contacts && parsed.contacts[0] && parsed.contacts[0].email) {
              console.warn("Old CRM schema detected. Falling back to MOCK_STATE");
              return MOCK_STATE; // Fallback entirely to ensure stability
           }
           return parsed;
        }
      }
    } catch(e) {}
    return MOCK_STATE;
  });

  // Persist State to Local Storage automatically
  useEffect(() => {
    localStorage.setItem("@trino:crm-state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const moveDeal = (dealId: string, newStageId: string) => {
    setState((prev) => {
      const deals = prev.deals.map(d => {
        if (d.id === dealId) {
          const oldStage = prev.pipelines.flatMap(p => p.stages).find(s => s.id === d.stageId);
          const newStage = prev.pipelines.flatMap(p => p.stages).find(s => s.id === newStageId);
          
          const newLog: HistoryLog = {
             id: `log_${Date.now()}`,
             description: "Etapa alterada",
             subtext: `De ${oldStage?.name || "Desconhecida"} para ${newStage?.name || "Desconhecida"}`,
             createdAt: new Date().toISOString()
          };

          return { ...d, stageId: newStageId, daysInStage: 0, history: [newLog, ...d.history] };
        }
        return d;
      });
      return { ...prev, deals };
    });
  };

  const markDealStatus = (dealId: string, status: "Ganho" | "Perdido" | "Ativo", reason?: string) => {
    setState((prev) => {
      const deals = prev.deals.map(d => {
        if (d.id === dealId) {
           const log: HistoryLog = {
             id: `log_${Date.now()}`,
             description: status === "Ativo" ? "Negócio reaberto" : `Negócio marcado como ${status}`,
             subtext: reason ? `Motivo: ${reason}` : "",
             createdAt: new Date().toISOString()
           };
           return { ...d, status: status as any, lossReason: reason, history: [log, ...d.history] };
        }
        return d;
      });
      return { ...prev, deals };
    });
  };

  const updateDealFields = (dealId: string, fields: Partial<Deal>) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, ...fields } : d)
    }));
  };

  const addDealNote = (dealId: string, content: string) => {
    setState((prev) => {
      const newNote: Note = { id: `note_${Date.now()}`, content, createdAt: new Date().toISOString() };
      return {
        ...prev,
        deals: prev.deals.map(d => d.id === dealId ? { ...d, notes: [newNote, ...d.notes] } : d)
      };
    });
  }

  const addDealHistory = (dealId: string, description: string, subtext: string) => {
     setState((prev) => {
       const newLog: HistoryLog = { id: `log_${Date.now()}`, description, subtext, createdAt: new Date().toISOString() };
       return {
         ...prev,
         deals: prev.deals.map(d => d.id === dealId ? { ...d, history: [newLog, ...d.history] } : d)
       };
     });
  };

  const deleteDeal = (dealId: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.filter(d => d.id !== dealId)
    }));
  };

  const addPipeline = (pipeline: Pipeline) => {
    setState(prev => ({ ...prev, pipelines: [...prev.pipelines, pipeline] }));
  };

  const deletePipeline = (pipelineId: string) => {
    setState(prev => ({ 
       ...prev, 
       pipelines: prev.pipelines.filter(p => p.id !== pipelineId),
       deals: prev.deals.filter(d => d.pipelineId !== pipelineId)
    }));
  };

  const updatePipeline = (pipelineId: string, fields: Partial<Pipeline>) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p => p.id === pipelineId ? { ...p, ...fields } : p)
    }));
  };

  const updateContact = (contactId: string, fields: Partial<Contact>) => {
    setState(prev => ({
       ...prev,
       contacts: prev.contacts.map(c => c.id === contactId ? { ...c, ...fields } : c)
    }));
  };

  const updateCompany = (companyId: string, fields: Partial<Company>) => {
    setState(prev => ({
       ...prev,
       companies: prev.companies.map(c => c.id === companyId ? { ...c, ...fields } : c)
    }));
  };

  const addLabel = (label: Label) => {
    setState(prev => ({ ...prev, labels: [...prev.labels, label] }));
  };

  const addDeal = (deal: Deal) => {
     setState(prev => ({ ...prev, deals: [...prev.deals, deal] }));
  };

  const addContact = (contact: Contact) => {
     setState(prev => ({ ...prev, contacts: [...prev.contacts, contact] }));
  };
  
  const addCompany = (company: Company) => {
     setState(prev => ({ ...prev, companies: [...prev.companies, company] }));
  };

  // --- Advanced Features ---
  
  const addAppointment = (appt: Omit<Appointment, "id" | "createdAt" | "status">) => {
    setState((prev) => {
      return {
        ...prev,
        deals: prev.deals.map(d => {
          if (d.id === appt.dealId) {
            
            // Cancel older appointments
            const updatedAppointments = d.appointments.map(a => 
              a.status === "Scheduled" ? { ...a, status: "Cancelled" as const } : a
            );
            
            const newAppointment: Appointment = {
              ...appt,
              id: `appt_${Date.now()}`,
              createdAt: new Date().toISOString(),
              status: "Scheduled"
            };
            
            updatedAppointments.unshift(newAppointment);

            const cancelLog: HistoryLog | null = d.appointments.some(a => a.status === "Scheduled") ? {
               id: `log_cancel_${Date.now()}`,
               description: "Agendamento Anterior Cancelado",
               subtext: "Cancelado porque um novo agendamento foi gerado",
               createdAt: new Date().toISOString()
            } : null;

            const newLog: HistoryLog = {
               id: `log_appt_${Date.now()}`,
               description: "Reunião Agendada",
               subtext: `Procedimento: ${appt.procedure} | Com: ${appt.attendant}`,
               createdAt: new Date().toISOString()
            };

            const history = [newLog, ...(cancelLog ? [cancelLog] : []), ...d.history];

            // Change stage if "Reuniao" or "Agendada" column exists
            const pipeline = prev.pipelines.find(p => p.id === d.pipelineId);
            let newStageId = d.stageId;
            if (pipeline) {
               const targetStage = pipeline.stages.find(s => s.name.toLowerCase().includes("agendada") || s.name.toLowerCase().includes("reunião") || s.name.toLowerCase().includes("reuniao"));
               if (targetStage) newStageId = targetStage.id;
            }

            return { ...d, appointments: updatedAppointments, history, stageId: newStageId };
          }
          return d;
        })
      };
    });
  };

  const addActivity = (act: Omit<Activity, "id" | "createdAt" | "completed">) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => {
        if (d.id === act.dealId) {
          const newAct: Activity = { ...act, id: `act_${Date.now()}`, createdAt: new Date().toISOString(), completed: false };
          return { ...d, activities: [newAct, ...d.activities] };
        }
        return d;
      })
    }));
  };

  const updateActivity = (activityId: string, fields: Partial<Activity>) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => ({
        ...d,
        activities: d.activities.map(a => a.id === activityId ? { ...a, ...fields } : a)
      }))
    }));
  };

  const deleteActivity = (activityId: string) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => ({
        ...d,
        activities: d.activities.filter(a => a.id !== activityId)
      }))
    }));
  };

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
         <div className="w-8 h-8 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin"></div>
         <p className="text-sm font-medium text-gray-500 mt-4">Carregando CRM...</p>
      </div>
    );
  }

  return (
    <CrmContext.Provider value={{
      state,
      moveDeal,
      markDealStatus,
      updateDealFields,
      addDealNote,
      addDealHistory,
      addDeal,
      deleteDeal,
      addPipeline,
      deletePipeline,
      updatePipeline,
      updateContact,
      addContact,
      updateCompany,
      addCompany,
      addLabel,
      addAppointment,
      addActivity,
      updateActivity,
      deleteActivity
    }}>
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (context === undefined) {
    throw new Error("useCrm must be used within a CrmProvider");
  }
  return context;
}
