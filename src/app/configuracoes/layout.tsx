"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "MINHA CONTA",
    items: [
      { label: "Perfil", href: "/configuracoes/perfil" },
      { label: "Planos e Faturamento", href: "/configuracoes/billing" },
    ]
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Empresa", href: "/configuracoes/empresa" },
      { label: "Usuários", href: "/configuracoes/usuarios" },
      { label: "Campos de dados", href: "/configuracoes/campos" },
      { label: "Importar dados", href: "/configuracoes/importar" },
      { label: "Produtos", href: "/configuracoes/produtos" },
      { label: "Motivos de Perda", href: "/configuracoes/motivos-perda" },
      { label: "Motivos de Exclusão", href: "/configuracoes/motivos-exclusao" },
      { label: "Tipos de Atividade", href: "/configuracoes/tipos-atividade" },
      { label: "Duplicatas", href: "/configuracoes/duplicatas" },
      { label: "Sequências", href: "/configuracoes/sequencias" },
      { label: "Templates de Email", href: "/configuracoes/email-templates" },
      { label: "Templates WhatsApp", href: "/configuracoes/whatsapp-templates" },
      { label: "Scripts de Ligação", href: "/configuracoes/scripts-ligacao" },
    ]
  },
  {
    title: "INTEGRAÇÕES",
    items: [
      { label: "WhatsApp", href: "/configuracoes/whatsapp" },
      { label: "Gmail", href: "/configuracoes/gmail" },
      { label: "Telefone", href: "/configuracoes/telefone" },
      { label: "Calendário", href: "/configuracoes/calendario" },
      { label: "API e Integrações", href: "/configuracoes/api" },
      { label: "Webhooks", href: "/configuracoes/webhooks" },
    ]
  }
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 bg-zinc-50/50 overflow-y-auto py-8 px-4 space-y-8 border-r border-zinc-100">
        {SECTIONS.map((section, idx) => (
          <div key={idx}>
            <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase px-3 mb-2">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-amber-600"
                          : "text-zinc-500 hover:bg-white/70 hover:text-zinc-900"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>
      <main className="flex-1 overflow-y-auto bg-zinc-50/30">
        {children}
      </main>
    </div>
  );
}
