"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquareText,
  Zap,
  Bell,
  CheckCircle2,
  Settings,
  Building2,
  ChevronDown,
  Target,
  Phone,
  Crosshair,
  PhoneCall,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  sub?: { label: string; href: string }[];
}

interface Section {
  label: string;
  items: NavItem[];
}

const SECTIONS: Section[] = [
  {
    label: "CRM",
    items: [
      { label: "Meu Painel", href: "/", icon: LayoutDashboard },
      { label: "Negócios", href: "/negocios", icon: Briefcase },
      { label: "Contatos", href: "/contatos", icon: Users },
      { label: "Atividades", href: "/atividades", icon: CheckCircle2, badge: 1 },
    ],
  },
  {
    label: "RELATÓRIOS",
    items: [
      { label: "Métricas", href: "/metricas", icon: Target },
      { label: "Ligações", href: "/ligacoes", icon: Phone },
      { label: "Metas", href: "/metas", icon: Target },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { label: "Prospecção", href: "/prospeccao", icon: Crosshair },
      { label: "Automações", href: "/automacoes", icon: Zap },
      { label: "Análise de Calls", href: "/analise-calls", icon: PhoneCall },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/dashboard" || pathname === "/" : pathname.startsWith(href);

  // Exclude configuracoes from regular sections as it goes below divider
  const topSections = SECTIONS.filter(s => s.label !== "FERRAMENTAS" || true); 
  // Let's manually implement the precise menu

  return (
    <aside className="flex h-screen shrink-0 flex-col bg-white border-r border-zinc-100/80 transition-[width] duration-200 ease-in-out overflow-hidden w-56">
      
      {/* Logo */}
      <div className="flex h-14 items-center px-3 shrink-0">
        <Link href="/">
           <img src="/logo.png" alt="DMhub" className="h-7 object-contain" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {/* CRM */}
        <div className="">
          <span className="px-3 mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            CRM
          </span>
          <ul className="space-y-0.5">
            {[
              { href: "/", label: "Meu Painel", icon: LayoutDashboard },
              { href: "/negocios", label: "Negócios", icon: Briefcase },
              { href: "/contatos", label: "Contatos", icon: Users },
              { href: "/atividades", label: "Atividades", icon: CheckCircle2 }
            ].map(item => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-zinc-700" : "text-zinc-400")} />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Relatórios */}
        <div className="mt-4">
          <span className="px-3 mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Relatórios
          </span>
          <ul className="space-y-0.5">
            {[
              { href: "/insights", label: "Métricas", icon: Target },
              { href: "/ligacoes", label: "Ligações", icon: Phone },
              { href: "/metas", label: "Metas", icon: Target }
            ].map(item => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-zinc-700" : "text-zinc-400")} />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Ferramentas */}
        <div className="mt-4">
          <span className="px-3 mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Ferramentas
          </span>
          <ul className="space-y-0.5">
            {[
              { href: "/prospeccao", label: "Prospecção", icon: Crosshair },
              { href: "/automacoes", label: "Automações", icon: Zap },
              { href: "/analise-calls", label: "Análise de Calls", icon: PhoneCall }
            ].map(item => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-zinc-700" : "text-zinc-400")} />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="my-3 mx-2 h-px bg-zinc-100"></div>
        <ul>
          <li>
            <Link
              href="/configuracoes"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive("/configuracoes") ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              )}
            >
               <Settings className={cn("h-[18px] w-[18px] shrink-0", isActive("/configuracoes") ? "text-zinc-700" : "text-zinc-400")} />
               <span className="flex-1 whitespace-nowrap overflow-hidden">Configurações</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Footer controls */}
      <div className="px-2 py-2 space-y-1">
        <button 
          title="Recolher" 
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-all duration-150"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 transition-transform duration-200" />
          <span className="whitespace-nowrap overflow-hidden text-xs">Recolher</span>
        </button>
      </div>
      
      <div className="border-t border-zinc-100/80 px-3 py-3">
         {/* User block space */}
      </div>
    </aside>
  );
}
