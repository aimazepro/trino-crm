import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getPlatformAdminFromSession } from "@/lib/platform-admin-server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getPlatformAdminFromSession();
  // 404, não 403: quem não é admin da plataforma nem fica sabendo que essa
  // rota existe.
  if (!admin) notFound();

  return (
    <div className="min-h-screen bg-zinc-50/30">
      <div className="border-b border-zinc-200 bg-white px-8 py-4">
        <h1 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Painel Admin — TrinoCRM</h1>
        <nav className="flex items-center gap-4 mt-3 text-sm font-semibold">
          <Link href="/admin" className="text-zinc-600 hover:text-amber-600">
            Workspaces
          </Link>
          <Link href="/admin/contas" className="text-zinc-600 hover:text-amber-600">
            Contas
          </Link>
        </nav>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}
