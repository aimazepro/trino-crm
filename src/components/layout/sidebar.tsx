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
  Activity,
  Settings,
  Building2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Negócios", href: "/negocios", icon: Briefcase },
  { label: "Empresas", href: "/empresas", icon: Building2 },
  { label: "Contatos", href: "/contatos", icon: Users },
  { label: "Conversas", href: "/conversas", icon: MessageSquareText, badge: 6 },
  { label: "Disparos", href: "/disparos", icon: Zap },
  { label: "Follow-up", href: "/follow-up", icon: Bell },
  { label: "Atividades", href: "/atividades", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen overflow-y-auto">
      {/* Header / Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-sm">
            <Zap size={20} className="fill-white/20" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Trino Flow</h1>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Marketing Hub</p>
          </div>
        </div>
      </div>

      {/* Empresa Ativa Dropdown Mock */}
      <div className="px-4 mb-6">
        <button className="w-full flex items-center gap-3 bg-gray-50/80 hover:bg-gray-100 border border-gray-100 p-3 rounded-2xl transition-colors text-left group">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
            <Building2 size={16} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium">Empresa ativa</p>
            <p className="text-sm font-semibold text-gray-900">Clínica Vida+</p>
          </div>
          <ChevronDown size={16} className="text-gray-400 group-hover:text-gray-600" />
        </button>
      </div>

      {/* Navegação Principal */}
      <div className="flex-1 px-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu</p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive 
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <item.icon 
                  size={18} 
                  className={cn(
                    isActive ? "text-white" : "text-gray-400 group-hover:text-amber-500",
                    "transition-colors"
                  )} 
                />
                
                <span className="flex-1">{item.label}</span>
                
                {item.badge && (
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center",
                    isActive 
                      ? "bg-white/20 text-white" 
                      : "bg-red-500 text-white"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Área Inferior (Configurações) */}
      <div className="p-4 mt-auto">
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group",
            pathname.startsWith("/configuracoes")
              ? "bg-orange-50 text-orange-600"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          <Settings size={18} className={pathname.startsWith("/configuracoes") ? "text-orange-500" : "text-gray-400 group-hover:text-amber-500"} />
          <span>Configurações</span>
        </Link>
        
        {/* User Profile Mini */}
        <div className="mt-4 flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.pravatar.cc/100?img=11" alt="Perfil" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">João Paulo</p>
            <p className="text-xs text-gray-500 truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
