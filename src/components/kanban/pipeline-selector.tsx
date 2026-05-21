"use client";

import { useState, useRef, useEffect } from "react";
import { Funnel, Check, Trash2, Plus, ChevronDown } from "lucide-react";
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
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <Funnel className="h-3.5 w-3.5 text-zinc-500" />
          {activePipeline.name}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
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

    </div>
  );
}
