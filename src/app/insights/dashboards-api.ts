"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Painéis customizados. A tabela `dashboards` é nova e ainda não está no
 * database.types.ts gerado, então o client é afrouxado só aqui — o shape
 * real fica garantido por Dashboard/DashboardRow abaixo.
 *
 * RLS: `dashboards_owner` (user_id = auth.uid()), igual a saved_reports.
 * Painel é por usuário: cada pessoa monta o seu.
 */
export interface Dashboard {
  id: string;
  name: string;
  reportIds: string[];
}

interface DashboardRow {
  id: string;
  name: string;
  report_ids: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createClient() as any).from("dashboards");
}

function fromRow(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    name: row.name,
    reportIds: Array.isArray(row.report_ids) ? (row.report_ids as string[]) : [],
  };
}

export async function listDashboards(workspaceId: string): Promise<Dashboard[]> {
  const { data, error } = await table()
    .select("id, name, report_ids")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[insights] falha ao carregar painéis:", error);
    return [];
  }
  return (data ?? []).map(fromRow);
}

export async function createDashboard(workspaceId: string, userId: string, name: string): Promise<Dashboard> {
  const { data, error } = await table()
    .insert({ workspace_id: workspaceId, user_id: userId, name, report_ids: [] })
    .select("id, name, report_ids")
    .single();
  if (error || !data) {
    console.error("[insights] falha ao criar painel:", error);
    throw new Error(error?.message ?? "Falha ao criar o painel.");
  }
  return fromRow(data);
}

export async function saveDashboardReports(id: string, reportIds: string[]): Promise<void> {
  const { error } = await table().update({ report_ids: reportIds }).eq("id", id);
  if (error) console.error("[insights] falha ao salvar o painel:", error);
}

export async function renameDashboardRow(id: string, name: string): Promise<void> {
  const { error } = await table().update({ name }).eq("id", id);
  if (error) console.error("[insights] falha ao renomear o painel:", error);
}

export async function deleteDashboardRow(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) console.error("[insights] falha ao excluir o painel:", error);
}
