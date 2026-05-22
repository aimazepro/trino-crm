"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search, Bell, HelpCircle, Menu, Briefcase, Users, Building2, X,
  Check, Clock, Trophy, MailOpen, CircleX, TriangleAlert
} from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CrmNotification } from "@/lib/crm-types";

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
      <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
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
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [toastNotif, setToastNotif] = useState<CrmNotification | null>(null);

  const { state, markNotificationAsRead, markAllNotificationsAsRead } = useCrm();
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", clickHandler);
    return () => document.removeEventListener("mousedown", clickHandler);
  }, []);

  useEffect(() => {
    const handleNewNotif = (e: Event) => {
      const notif = (e as CustomEvent).detail as CrmNotification;
      setToastNotif(notif);
      const timer = setTimeout(() => {
        setToastNotif(null);
      }, 4000);
      return () => clearTimeout(timer);
    };
    window.addEventListener("new-notification", handleNewNotif);
    return () => window.removeEventListener("new-notification", handleNewNotif);
  }, []);

  const unreadCount = state.notifications?.filter(n => !n.read).length ?? 0;

  return (
    <>
      <header className="flex items-center gap-4 border-b border-border bg-card px-6 py-2 shrink-0 h-14">
        {/* Left spacing/mobile menu button */}
        <button className="md:hidden shrink-0 text-zinc-500 hover:text-zinc-700">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 hidden md:block"></div>

        {/* Centered Search Button */}
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2.5 w-full max-w-md rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground hover:border-muted-foreground/30 hover:bg-card transition-colors"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left text-[13px] text-muted-foreground">Pesquisar negócios, contatos, empresas...</span>
          <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground sm:block">⌘K</kbd>
        </button>

        {/* Right Actions */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <div className="relative">
            <button title="Ajuda" aria-label="Ajuda" className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
          
          {/* Notifications Dropdown Wrapper */}
          <div className="relative" ref={notifRef}>
            <button
              title="Notificacoes"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors",
                isNotifOpen && "bg-zinc-100 text-zinc-700"
              )}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Menu */}
            {isNotifOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-700 uppercase tracking-widest">Notificacoes</p>
                  <button
                    onClick={() => markAllNotificationsAsRead()}
                    className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-600 font-medium transition-colors"
                  >
                    <Check className="h-3 w-3" /> Marcar todas como lidas
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto divide-y divide-zinc-50">
                  {state.notifications && state.notifications.length > 0 ? (
                    state.notifications.map((notif) => {
                      let iconBg = "bg-amber-50";
                      let iconColor = "text-amber-500";
                      let IconComp = Clock;

                      if (notif.type === "activity") {
                        if (notif.subtext.includes("atrasado")) {
                          iconBg = "bg-red-50";
                          iconColor = "text-red-500";
                          IconComp = TriangleAlert;
                        } else {
                          iconBg = "bg-amber-50";
                          iconColor = "text-amber-500";
                          IconComp = Clock;
                        }
                      } else if (notif.type === "deal_status") {
                        if (notif.subtext.toLowerCase().includes("perdido")) {
                          iconBg = "bg-red-50";
                          iconColor = "text-red-400";
                          IconComp = CircleX;
                        } else {
                          iconBg = "bg-green-50";
                          iconColor = "text-green-500";
                          IconComp = Trophy;
                        }
                      } else if (notif.type === "email_open") {
                        iconBg = "bg-blue-50";
                        iconColor = "text-blue-600";
                        IconComp = MailOpen;
                      }

                      return (
                        <a
                          key={notif.id}
                          href={notif.href}
                          onClick={(e) => {
                            e.preventDefault();
                            markNotificationAsRead(notif.id);
                            router.push(notif.href);
                            setIsNotifOpen(false);
                          }}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors",
                            !notif.read && "bg-amber-50/40"
                          )}
                        >
                          <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconBg)}>
                            <IconComp className={cn("h-3.5 w-3.5", iconColor)} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-zinc-900 truncate">{notif.title}</p>
                              {notif.type === "email_open" && (
                                <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                                  Email aberto
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 truncate">{notif.subtext}</p>
                          </div>
                          
                          {!notif.read && (
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"></span>
                          )}
                        </a>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-zinc-400">
                      Nenhuma notificação por enquanto.
                    </div>
                  )}
                </div>
                
                <div className="border-t border-zinc-100 px-4 py-2.5">
                  <a
                    href="/atividades"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push("/atividades");
                      setIsNotifOpen(false);
                    }}
                    className="text-xs font-medium text-amber-500 hover:text-amber-600 transition-colors animate-in"
                  >
                    Ver todas as atividades
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {/* Real-time Toast notification */}
      {toastNotif && (
        <div
          onClick={() => {
            markNotificationAsRead(toastNotif.id);
            router.push(toastNotif.href);
            setToastNotif(null);
          }}
          className="fixed top-4 right-4 z-[300] flex max-w-sm w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl transition-all duration-300 animate-in slide-in-from-top-5 cursor-pointer hover:bg-zinc-50"
        >
          <div className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            toastNotif.type === "activity" ? "bg-amber-50" : toastNotif.type === "email_open" ? "bg-blue-50" : "bg-green-50"
          )}>
            {toastNotif.type === "activity" && <Clock className="h-4 w-4 text-amber-500" />}
            {toastNotif.type === "deal_status" && (
              toastNotif.subtext.toLowerCase().includes("perdido") ? (
                <CircleX className="h-4 w-4 text-red-500" />
              ) : (
                <Trophy className="h-4 w-4 text-green-500" />
              )
            )}
            {toastNotif.type === "email_open" && <MailOpen className="h-4 w-4 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Nova Notificação</p>
            <p className="text-sm font-semibold text-zinc-900 truncate mt-0.5">{toastNotif.title}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{toastNotif.subtext}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setToastNotif(null);
            }}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
