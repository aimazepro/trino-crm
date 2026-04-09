"use client";

import { LayoutGrid, List, Eye, Trophy, XCircle, Download, Plus, Settings, Search } from "lucide-react";

interface KanbanToolbarProps {
  onNewDeal: () => void;
}

export function KanbanToolbar({ onNewDeal }: KanbanToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-2 shadow-sm mb-6">
      {/* Left / Center - Search */}
      <div className="flex-1 flex justify-center">
         <div className="relative w-full max-w-lg">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Pesquisar negócios, contatos, empresas..."
              className="w-full bg-gray-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-amber-500 text-sm rounded-lg pl-9 pr-12 py-2 outline-none transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
               <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-gray-200 bg-white px-1.5 font-mono text-[10px] font-medium text-gray-500 shadow-sm">
                  ⌘K
               </kbd>
            </div>
         </div>
      </div>

      {/* Right - Filters & Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-4 overflow-x-auto hide-scrollbar">
        {/* Toggle Grid/List */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
           <button className="p-1.5 bg-white shadow-sm rounded-md text-gray-800"><LayoutGrid size={16}/></button>
           <button className="p-1.5 text-gray-500 hover:text-gray-800 transition-colors"><List size={16}/></button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1"></div>

        {/* View Filters */}
        <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-100 transition-colors">
          <Eye size={14} className="text-gray-500" />
          Ativos
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-50 transition-colors">
          <Trophy size={14} className="text-gray-400" />
          Ganhos
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-50 transition-colors">
          <XCircle size={14} className="text-gray-400" />
          Perdidos
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1"></div>

        {/* Actions */}
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={14} className="text-gray-400" />
          Exportar
        </button>
        
        <button 
          onClick={onNewDeal}
          className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-lg shadow-sm shadow-amber-500/20 hover:bg-amber-600 transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          Novo Negócio
        </button>

        <button className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors border border-transparent hover:bg-gray-50 rounded-lg">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
