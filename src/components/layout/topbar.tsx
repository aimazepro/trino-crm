import { Search, Bell, HelpCircle } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-16 flex items-center px-6 bg-white border-b border-gray-100 sticky top-0 z-10">
      
      {/* Busca Global */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className="relative group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar negócios, contatos, empresas..."
            className="w-full bg-gray-50/50 border border-gray-200 text-sm rounded-xl pl-10 pr-4 py-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-gray-700"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded">⌘</kbd>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded">K</kbd>
          </div>
        </div>
      </div>

      {/* Ações da Direita */}
      <div className="flex items-center gap-4 absolute right-6">
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <HelpCircle size={20} />
        </button>
        
        <button className="text-gray-400 hover:text-gray-600 transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-white">
            2
          </span>
        </button>
      </div>
      
    </header>
  );
}
