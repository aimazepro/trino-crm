"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkspaceInfo } from "@/lib/workspace";
import { can, type Capability } from "@/lib/permissions";

// `capability` marca o item que some para quem não tem o papel. Some do menu e
// a rota também recusa (<RequireCapability> na página) -- esconder o link
// sozinho só faz o vendedor descobrir a URL, e a URL direta era exatamente o
// buraco que /automacoes/nova tinha antes do P1.
const SECTIONS: { title: string; items: { label: string; href: string; capability?: Capability }[] }[] = [
  {
    title: "MINHA CONTA",
    items: [
      { label: "Perfil", href: "/configuracoes/perfil" },
      // "Planos e Faturamento" tirado do menu (Fase 0 item 5): billing é
      // 100% mockado (faturas fake hardcoded, botão "Alterar plano" não faz
      // nada) -- decoração enganosa, prometeria cobrança real que não
      // existe. Código fica (ver docs/BACKLOG.md Fase 6), só o link some.
    ]
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Empresa", href: "/configuracoes/empresa" },
      { label: "Usuários", href: "/configuracoes/usuarios" },
      { label: "Campos de dados", href: "/configuracoes/campos", capability: "gerenciar_campos" },
      { label: "Importar dados", href: "/configuracoes/importar" },
      { label: "Produtos", href: "/configuracoes/produtos" },
      { label: "Motivos de Perda", href: "/configuracoes/motivos-perda", capability: "gerenciar_motivos_perda" },
      { label: "Motivos de Exclusão", href: "/configuracoes/motivos-exclusao", capability: "gerenciar_motivos_exclusao" },
      { label: "Tipos de Atividade", href: "/configuracoes/tipos-atividade", capability: "gerenciar_tipos_atividade" },
      { label: "Duplicatas", href: "/configuracoes/duplicatas", capability: "mesclar_duplicatas" },
      { label: "Sequências", href: "/configuracoes/sequencias", capability: "gerenciar_sequencias" },
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
  const info = useWorkspaceInfo();

  // Produtos fica no menu de propósito: é "só leitura", não "sem acesso" -- o
  // vendedor vê o catálogo, os botões de escrita é que somem.
  const sections = SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.capability || can(info?.role, item.capability)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 bg-zinc-50/50 overflow-y-auto py-8 px-4 space-y-8 border-r border-zinc-100">
        {sections.map((section, idx) => (
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
