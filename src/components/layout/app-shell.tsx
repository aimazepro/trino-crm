"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CrmProvider, useCrm } from "@/contexts/crm-context";
import { AutomacoesProvider } from "@/contexts/automacoes-context";
import { WorkspaceProvider } from "@/lib/workspace";

function AppContent({ children }: { children: React.ReactNode }) {
  const { loading } = useCrm();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F4F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F5]">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/convite")) return <>{children}</>;
  return (
    <WorkspaceProvider>
      <CrmProvider>
        <AutomacoesProvider>
          <AppContent>{children}</AppContent>
        </AutomacoesProvider>
      </CrmProvider>
    </WorkspaceProvider>
  );
}
