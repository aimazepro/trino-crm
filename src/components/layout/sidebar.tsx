"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceInfo } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

import { getInitials } from "@/hooks/use-owner-name-map";

export function Sidebar() {
  const pathname = usePathname();
  const workspaceInfo = useWorkspaceInfo();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setDisplayName((user.user_metadata?.full_name as string | undefined) || user.email || "");
        setAvatarUrl((user.user_metadata?.avatar_url as string | undefined) || null);
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    if (href === "/pipeline") {
      return pathname.startsWith("/pipeline") || pathname.startsWith("/negocios");
    }
    if (href === "/contatos") {
      return pathname.startsWith("/contatos") || pathname.startsWith("/empresas");
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex h-screen shrink-0 flex-col bg-white border-r border-zinc-100/80 transition-[width] duration-200 ease-in-out overflow-hidden w-56">
      {/* Logo */}
      <div className="flex h-14 items-center px-3 shrink-0">
        <Link href="/">
          <Image alt="TrinoDeal" className="h-7 object-contain" src="/logo-trino-marca.png" width={28} height={28} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {/* CRM */}
        <div>
          <span className="px-3 mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            CRM
          </span>
          <ul className="space-y-0.5">
            {[
              { href: "/dashboard", label: "Meu Painel", icon: LayoutDashboard },
              { href: "/pipeline", label: "Negócios", icon: Briefcase },
              { href: "/contatos", label: "Contatos", icon: Users, sub: [{ href: "/contatos", label: "Pessoas" }, { href: "/empresas", label: "Empresas" }] },
              { href: "/atividades", label: "Atividades", icon: CheckCircle2 },
              { href: "/conversas", label: "Conversas", icon: MessageCircle },
            ].map((item) => {
              const active = isActive(item.href);
              const hasSub = "sub" in item && item.sub;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-zinc-700" : "text-zinc-400"
                      )}
                    />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  </Link>
                  {hasSub && active && (
                    <ul className="mt-0.5 ml-7 space-y-0.5">
                      {item.sub!.map(s => {
                        const subActive = pathname.startsWith(s.href) && !(s.href === "/contatos" && pathname.startsWith("/empresas"));
                        return (
                          <li key={s.href}>
                            <Link
                              href={s.href}
                              className={cn(
                                "block rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                                subActive ? "text-amber-600" : "text-zinc-400 hover:text-zinc-700"
                              )}
                            >
                              {s.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
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
              { href: "/insights", label: "Métricas", icon: BarChart3 },
              { href: "/forecast", label: "Forecast", icon: Crosshair },
              { href: "/ligacoes", label: "Ligações", icon: Phone },
              { href: "/metas", label: "Metas", icon: Target },
            ].map((item) => {
              // We'll use standard lucide BarChart3 for metrics, imported as BarChart3
              const active = isActive(item.href);
              const Icon = item.icon === BarChart3 ? BarChart3 : item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-zinc-700" : "text-zinc-400"
                      )}
                    />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
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
              // "Prospecção" e "Análise de Calls" tirados do menu (Fase 0
              // item 5): sem page.tsx, sempre foram 404 -- decoração, não
              // feature. Rotas continuam fora do código; se um dia forem
              // construídas de verdade, voltam pra cá.
              { href: "/automacoes", label: "Automações", icon: Zap },
            ].filter((item) =>
              // Item some para vendedor. Some do menu e a rota também recusa --
              // esconder link sozinho só faz o vendedor descobrir a URL.
              item.href === "/automacoes" ? can(workspaceInfo?.role, "gerenciar_automacoes") : true
            ).map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-zinc-700" : "text-zinc-400"
                      )}
                    />
                    <span className="flex-1 whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="my-3 mx-2 h-px bg-zinc-100"></div>
        <ul>
          <li>
            <Link
              href="/configuracoes/perfil"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive("/configuracoes")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              )}
            >
              <Settings
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive("/configuracoes") ? "text-zinc-700" : "text-zinc-400"
                )}
              />
              <span className="flex-1 whitespace-nowrap overflow-hidden">
                Configurações
              </span>
            </Link>
          </li>
          <li className="mt-1">
            <button
              onClick={() => {}}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-all duration-150 text-left"
            >
              <ChevronLeft className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
              <span className="flex-1 whitespace-nowrap overflow-hidden text-xs">
                Recolher
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {/* User footer - Clerk style */}
      <div className="border-t border-zinc-100/80 px-3 py-3 shrink-0">
        <div className="cl-rootBox cl-userButton-root">
          <button
            onClick={handleLogout}
            className="cl-userButtonTrigger cl-button flex w-full items-center justify-between gap-3 px-2 py-1 hover:bg-zinc-50 rounded-xl transition-all duration-150 cursor-pointer"
            aria-label="Abrir menu do usuário"
          >
            <span className="cl-userButtonOuterIdentifier text-[13px] font-medium text-zinc-600 truncate">
              {displayName}
            </span>
            <span className="cl-avatarBox cl-userButtonAvatarBox relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-100 bg-gradient-to-tr from-purple-600 to-indigo-500 items-center justify-center shadow-xs">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-extrabold text-white uppercase tracking-tighter">
                  {getInitials(displayName)}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// We'll also import BarChart3 for use in the list
import { BarChart3 } from "lucide-react";
