import { Search, Bell, HelpCircle, Menu } from "lucide-react";

export function Topbar() {
  return (
    <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 py-2 shrink-0">
      <button className="md:hidden shrink-0 text-zinc-500 hover:text-zinc-700">
        <Menu className="h-5 w-5" />
      </button>
      
      <div className="flex-1 hidden md:block"></div>
      
      <button className="flex items-center gap-2.5 w-full max-w-md rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:bg-white transition-colors">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="flex-1 text-left">Pesquisar negócios, contatos, empresas...</span>
        <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-500 sm:block">
          ⌘K
        </kbd>
      </button>
      
      <div className="flex-1 flex items-center justify-end gap-2">
        <div className="relative">
          <button 
            data-hubia-trigger="true" 
            className="relative rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors" 
            aria-label="Ajuda" 
            title="Ajuda"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          <button 
            title="Notificações" 
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
