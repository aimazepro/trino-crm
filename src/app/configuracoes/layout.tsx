"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, CreditCard, LayoutTemplate, Bot, ListTree, MessageCircle, Camera, Code, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Minha Conta",
    items: [
      { label: "Perfil", href: "/configuracoes", icon: User },
      { label: "Planos e Faturamento", href: "/configuracoes/planos", icon: CreditCard },
    ]
  },
  {
    title: "Workspace",
    items: [
      { label: "Campos Personalizados", href: "/configuracoes/campos", icon: LayoutTemplate },
      { label: "Inteligência Artificial", href: "/configuracoes/ia", icon: Bot },
      { label: "Sequências (Cadências)", href: "/configuracoes/sequencias", icon: ListTree },
    ]
  },
  {
    title: "Integrações",
    items: [
      { label: "WhatsApp Externo", href: "/configuracoes/whatsapp", icon: MessageCircle },
      { label: "Instagram Direct", href: "/configuracoes/instagram", icon: Camera },
      { label: "API", href: "/configuracoes/api", icon: Code },
      { label: "Webhooks", href: "/configuracoes/webhooks", icon: Webhook },
    ]
  }
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[calc(100vh-8rem)]">
      
      {/* Sidebar de Configurações */}
      <div className="w-64 border-r border-gray-200 bg-gray-50/50 overflow-y-auto">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Configurações</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie suas preferências</p>
        </div>

        <div className="px-4 py-4 space-y-6">
          {SECTIONS.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 px-2">
                {section.title}
              </h3>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors group",
                        isActive 
                          ? "bg-amber-50 text-amber-700" 
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <item.icon size={16} className={isActive ? "text-amber-600" : "text-gray-400 group-hover:text-gray-600"} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 overflow-y-auto bg-white p-8">
        <div className="max-w-2xl">
          {children}
        </div>
      </div>

    </div>
  );
}
