"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  User, CreditCard, Building2, Users, LayoutTemplate, DownloadCloud, 
  Package, FileX, Copy, ListTree, Mail, MessageCircle, FileText, 
  MessageSquare, Phone, Calendar, Blocks 
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "MINHA CONTA",
    items: [
      { label: "Perfil", href: "/configuracoes", icon: User },
      { label: "Planos e Faturamento", href: "/configuracoes/planos", icon: CreditCard },
    ]
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Empresa", href: "/configuracoes/empresa", icon: Building2 },
      { label: "Usuários", href: "/configuracoes/usuarios", icon: Users },
      { label: "Campos de dados", href: "/configuracoes/campos", icon: LayoutTemplate },
      { label: "Importar dados", href: "/configuracoes/importacao", icon: DownloadCloud },
      { label: "Produtos", href: "/configuracoes/produtos", icon: Package },
      { label: "Motivos de Perda", href: "/configuracoes/motivos-perda", icon: FileX },
      { label: "Duplicatas", href: "/configuracoes/duplicatas", icon: Copy },
      { label: "Sequências", href: "/configuracoes/sequencias", icon: ListTree },
      { label: "Templates de Email", href: "/configuracoes/templates-email", icon: Mail },
      { label: "Templates WhatsApp", href: "/configuracoes/templates-whatsapp", icon: MessageCircle },
      { label: "Scripts de Ligação", href: "/configuracoes/scripts", icon: FileText },
    ]
  },
  {
    title: "INTEGRAÇÕES",
    items: [
      { label: "WhatsApp", href: "/configuracoes/whatsapp", icon: MessageSquare },
      { label: "Gmail", href: "/configuracoes/gmail", icon: Mail },
      { label: "Telefone", href: "/configuracoes/telefone", icon: Phone },
      { label: "Calendário", href: "/configuracoes/calendario", icon: Calendar },
      { label: "Integrações", href: "/configuracoes/integracoes", icon: Blocks },
      { label: "API", href: "/configuracoes/api", icon: FileText },
      { label: "Webhooks", href: "/configuracoes/webhooks", icon: ListTree },
    ]
  }
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#F4F4F5]">
      
      {/* Sidebar de Configurações */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-zinc-200 overflow-y-auto custom-scrollbar">
        <div className="p-6 pb-2 border-b border-zinc-100 flex items-center h-[60px]">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Configurações</h2>
        </div>

        <div className="px-4 py-6 space-y-8">
          {SECTIONS.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3 px-3">
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
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors group",
                        isActive 
                          ? "bg-amber-50 text-amber-600" 
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      )}
                    >
                      {isActive && <div className="absolute left-0 w-1 h-5 bg-amber-500 rounded-r-full" />}
                      <item.icon size={16} className={cn("flex-shrink-0", isActive ? "text-amber-500" : "text-zinc-400 group-hover:text-zinc-600")} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 overflow-y-auto bg-[#F4F4F5] custom-scrollbar">
        {children}
      </div>

    </div>
  );
}
