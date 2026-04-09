"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CrmState, Pipeline, Deal, Contact, Company, Label, HistoryLog, Note } from "@/lib/crm-types";
import { MOCK_STATE } from "@/lib/crm-mock";

interface CrmContextType {
  state: CrmState;
  
  // Deal Mutations
  moveDeal: (dealId: string, newStageId: string) => void;
  markDealStatus: (dealId: string, status: "Ganho" | "Perdido", reason?: string) => void;
  updateDealFields: (dealId: string, fields: Partial<Deal>) => void;
  addDealNote: (dealId: string, content: string) => void;
  addDealHistory: (dealId: string, description: string, subtext: string) => void;
  addDeal: (deal: Deal) => void;
  
  // Pipeline Mutations
  addPipeline: (pipeline: Pipeline) => void;
  deletePipeline: (pipelineId: string) => void;
  
  // Global Relations
  updateContact: (contactId: string, fields: Partial<Contact>) => void;
  addContact: (contact: Contact) => void;
  addCompany: (company: Company) => void;
  addLabel: (label: Label) => void;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  
  const [state, setState] = useState<CrmState>(() => {
    // Try to restore from localStorage if exists, else MOCK
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("@trino:crm-state");
        if (saved) return JSON.parse(saved);
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
          
          // Generate history log
          const oldStage = prev.pipelines.flatMap(p => p.stages).find(s => s.id === d.stageId);
          const newStage = prev.pipelines.flatMap(p => p.stages).find(s => s.id === newStageId);
          
          const newLog: HistoryLog = {
             id: `log_${Date.now()}`,
             description: "Etapa alterada",
             subtext: `De ${oldStage?.name || "Desconhecida"} para ${newStage?.name || "Desconhecida"}`,
             createdAt: new Date().toISOString()
          };

          return { 
            ...d, 
            stageId: newStageId, 
            daysInStage: 0,
            history: [newLog, ...d.history]
          };
        }
        return d;
      });
      return { ...prev, deals };
    });
  };

  const markDealStatus = (dealId: string, status: "Ganho" | "Perdido", reason?: string) => {
    setState((prev) => {
      const deals = prev.deals.map(d => {
        if (d.id === dealId) {
           const log: HistoryLog = {
             id: `log_${Date.now()}`,
             description: `Negócio marcado como ${status}`,
             subtext: reason ? `Motivo: ${reason}` : "",
             createdAt: new Date().toISOString()
           };
           return { ...d, status, lossReason: reason, history: [log, ...d.history] };
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

  const addPipeline = (pipeline: Pipeline) => {
    setState(prev => ({ ...prev, pipelines: [...prev.pipelines, pipeline] }));
  };

  const deletePipeline = (pipelineId: string) => {
    setState(prev => ({ 
       ...prev, 
       pipelines: prev.pipelines.filter(p => p.id !== pipelineId),
       // We should ideally orphan or move deals, but for UI sake we drop them or keep them hidden
       deals: prev.deals.filter(d => d.pipelineId !== pipelineId)
    }));
  };

  const updateContact = (contactId: string, fields: Partial<Contact>) => {
    setState(prev => ({
       ...prev,
       contacts: prev.contacts.map(c => c.id === contactId ? { ...c, ...fields } : c)
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
      addPipeline,
      deletePipeline,
      updateContact,
      addContact,
      addCompany,
      addLabel
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
