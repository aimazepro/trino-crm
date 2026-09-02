"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { can, type PlatformRole } from "@/lib/platform-admin";

// Caminhos limpos, sem "/painel": no host do painel o proxy reescreve
// /contas -> /painel/contas e usePathname() devolve a URL visível.
const LINKS = [
  { href: "/", label: "Dashboard", ability: "read_aggregates" as const },
  { href: "/contas", label: "Contas", ability: "read_customer_data" as const },
  { href: "/auditoria", label: "Auditoria", ability: "read_customer_data" as const },
] as const;

interface PanelNavProps {
  role: PlatformRole;
}

export function PanelNav({ role }: PanelNavProps) {
  const pathname = usePathname();

  // Esconder o link é só cosmético: a rota valida a permissão de novo no
  // servidor. Um papel sem a habilidade que tenta acessar diretamente leva
  // um 401/403, não um redirect silencioso.
  const visibleLinks = LINKS.filter((link) => can(role, link.ability));

  return (
    <nav className="flex items-center gap-1 text-sm font-semibold">
      {visibleLinks.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-colors",
              active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
