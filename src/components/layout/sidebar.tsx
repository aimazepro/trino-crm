"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Zap,
  CheckCircle2,
  Settings,
  Target,
  Phone,
  Crosshair,
  PhoneCall,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";


export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/dashboard" || pathname === "/" : pathname.startsWith(href);

  const contatosActive = pathname.startsWith("/contatos") || pathname.startsWith("/empresas");

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

            {/* Contatos com sub-itens */}
            <li>
              <Link
                href="/contatos"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  contatosActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                )}
              >
                <Users className={cn("h-[18px] w-[18px] shrink-0", contatosActive ? "text-zinc-700" : "text-zinc-400")} />
                <span className="flex-1 whitespace-nowrap overflow-hidden">Contatos</span>
              </Link>
              <ul className="ml-8 mt-0.5 space-y-0.5">
                <li>
                  <Link
                    href="/contatos"
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                      pathname.startsWith("/contatos") && !pathname.startsWith("/contatos/") ? "text-amber-600 font-semibold" : pathname.startsWith("/contatos/") ? "text-amber-600 font-semibold" : "text-zinc-400 hover:text-zinc-700"
                    )}
                  >
                    Pessoas
                  </Link>
                </li>
                <li>
                  <Link
                    href="/empresas"
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                      pathname.startsWith("/empresas") ? "text-amber-600 font-semibold" : "text-zinc-400 hover:text-zinc-700"
                    )}
                  >
                    Empresas
                  </Link>
                </li>
              </ul>
            </li>

            {[
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

      {/* User footer */}
      <div className="border-t border-zinc-100/80 px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-zinc-50 transition-colors cursor-pointer group">
          <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
            P
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 truncate">Pixeo Digital</p>
            <p className="text-[10px] font-medium text-zinc-400 truncate">Administrador</p>
          </div>
          <LogOut className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-500 shrink-0 transition-colors" />
        </div>
      </div>
    </aside>
  );
}
