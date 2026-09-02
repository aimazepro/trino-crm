import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getPlatformAdminFromSession } from "@/lib/platform-admin-server";
import { PanelNav } from "@/components/painel/panel-nav";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "dono",
  support: "suporte",
  billing: "cobrança",
};

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const admin = await getPlatformAdminFromSession();
  // "/entrar" e não "/painel/entrar": o Location é resolvido pelo navegador
  // contra o host do painel, e lá o proxy reescreve.
  if (!admin) redirect("/entrar");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm font-black tracking-tight text-zinc-900">
            Painel da Plataforma
          </span>
          <PanelNav role={admin.role} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">{admin.email}</span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-bold text-zinc-600">
            {ROLE_LABEL[admin.role] ?? admin.role}
          </span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
