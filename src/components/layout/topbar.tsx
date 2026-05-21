"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, HelpCircle, Menu, Briefcase, Users, Building2, X } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { state } = useCrm();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const q = query.toLowerCase().trim();

  const deals = q ? state.deals.filter(d => d.title.toLowerCase().includes(q)).slice(0, 4) : [];
  const contacts = q ? state.contacts.filter(c => c.name.toLowerCase().includes(q) || c.emails?.[0]?.value?.toLowerCase().includes(q)).slice(0, 4) : [];
  const companies = q ? state.companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 3) : [];

  const hasResults = deals.length > 0 || contacts.length > 0 || companies.length > 0;

  const go = (href: string) => { router.push(href); onClose(); };

  return (
    <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-100">
          <Search size={17} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar negócios, contatos, empresas..."
            className="flex-1 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          />
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!q && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Search size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Digite para pesquisar</p>
            </div>
          )}

          {q && !hasResults && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <p className="text-sm font-medium">Nenhum resultado para &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {deals.length > 0 && (
            <div className="px-2 pt-3 pb-1">
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Negócios</p>
              {deals.map(d => (
                <button key={d.id} onClick={() => go(`/negocios/${d.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors text-left group">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Briefcase size={13} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 group-hover:text-amber-600 transition-colors">{d.title}</p>
                    <p className="text-[11px] text-zinc-400">{d.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {d.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {contacts.length > 0 && (
            <div className="px-2 pt-2 pb-1">
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Contatos</p>
              {contacts.map(c => (
                <button key={c.id} onClick={() => go(`/contatos/${c.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors text-left group">
                  <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-600 font-bold flex items-center justify-center text-xs shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 group-hover:text-amber-600 transition-colors">{c.name}</p>
                    <p className="text-[11px] text-zinc-400">{c.emails?.[0]?.value || c.role || "Contato"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {companies.length > 0 && (
            <div className="px-2 pt-2 pb-3">
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Empresas</p>
              {companies.map(c => (
                <button key={c.id} onClick={() => go(`/empresas/${c.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors text-left group">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 group-hover:text-amber-600 transition-colors">{c.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Topbar() {
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-2 shrink-0">
        <button className="md:hidden shrink-0 text-zinc-500 hover:text-zinc-700">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 hidden md:block" />
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2.5 w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-sm text-zinc-500 hover:border-zinc-300 hover:bg-white transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="flex-1 text-left text-[13px]">Pesquisar negócios, contatos, empresas...</span>
          <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-400 sm:block">⌘K</kbd>
        </button>
        <div className="flex items-center gap-1">
          <button title="Ajuda" className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button title="Notificações" className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button title="Meu perfil" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition-colors">
            <div className="w-6 h-6 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">J</div>
            <span className="hidden lg:block text-[12px] font-semibold text-zinc-700">João Paulo Olivera</span>
          </button>
        </div>
      </header>

      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
    </>
  );
}
