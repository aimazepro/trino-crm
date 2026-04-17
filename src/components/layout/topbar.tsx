import { Search, Bell, HelpCircle, Menu } from "lucide-react";

export function Topbar() {
  return (
    <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-2 shrink-0">
      <button className="md:hidden shrink-0 text-zinc-500 hover:text-zinc-700">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 hidden md:block"></div>

      <button className="flex items-center gap-2.5 w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-sm text-zinc-500 hover:border-zinc-300 hover:bg-white transition-colors">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="flex-1 text-left text-[13px]">Pesquisar...</span>
        <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-400 sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <button
          title="Ajuda"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          title="Notificações"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-zinc-200 mx-1" />
        <button
          title="Meu perfil"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            P
          </div>
          <span className="hidden lg:block text-[12px] font-semibold text-zinc-700">Pixeo Digital</span>
        </button>
      </div>
    </header>
  );
}
