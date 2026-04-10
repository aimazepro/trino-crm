"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, Check, Trash2, Plus, ChevronDown } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { cn } from "@/lib/utils";

interface PipelineSelectorProps {
  activeId: string;
  onChange: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
}

export function PipelineSelector({ activeId, onChange, onNew, onEdit }: PipelineSelectorProps) {
  const { state, deletePipeline } = useCrm();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activePipeline = state.pipelines.find(p => p.id === activeId) || state.pipelines[0];

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activePipeline) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">{activePipeline.name}</span>
          <ChevronDown size={14} className="text-gray-400 ml-1" />
        </button>

        {open && (
           <div className="absolute top-full mt-2 left-0 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
             <div className="max-h-64 overflow-y-auto">
               {state.pipelines.map(pipe => (
                 <div 
                   key={pipe.id}
                   className="group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                   onClick={() => { onChange(pipe.id); setOpen(false); }}
                 >
                   <div className="flex items-center gap-2">
                     <div className="w-4 flex justify-center">
                       {pipe.id === activeId && <Check size={14} className="text-gray-900" />}
                     </div>
                     <span className={cn("text-sm", pipe.id === activeId ? "font-bold text-gray-900" : "font-medium text-gray-600")}>
                       {pipe.name}
                     </span>
                   </div>
                   
                   {/* Delete Icon (hidden unless hovered, but don't delete if it's the last one) */}
                   {state.pipelines.length > 1 && (
                     <button 
                       onClick={(e) => {
                         e.stopPropagation(); // Avoid triggering select
                         deletePipeline(pipe.id);
                         if (pipe.id === activeId) onChange(state.pipelines.filter(p => p.id !== pipe.id)[0].id);
                       }}
                       className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all mr-1"
                       title="Apagar Pipeline"
                     >
                       <Trash2 size={14} />
                     </button>
                   )}
                 </div>
               ))}
             </div>
             
             <div className="h-px bg-gray-100 my-1"></div>
             
             <div 
               className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-500 hover:text-amber-600 transition-colors"
               onClick={() => { setOpen(false); onNew(); }}
             >
               <div className="w-4 flex justify-center"><Plus size={14} /></div>
               <span className="text-sm font-semibold">Novo Pipeline</span>
             </div>
           </div>
        )}
      </div>

      <button 
        onClick={() => onEdit(activeId)}
        className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 hover:bg-gray-50 rounded-lg bg-white shadow-sm"
        title="Configurações do Pipeline"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  );
}
