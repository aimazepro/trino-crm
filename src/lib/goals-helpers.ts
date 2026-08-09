import { SupabaseClient } from "@supabase/supabase-js";

export interface GoalPeriodRange {
  from: string;
  to: string;
}

export function getGoalPeriodRange(
  period: string,
  startDate?: string | null,
  endDate?: string | null
): GoalPeriodRange {
  if (startDate && endDate) {
    const from = new Date(startDate).toISOString();
    const to = new Date(`${endDate}T23:59:59.999Z`).toISOString();
    return { from, to };
  }
  const now = new Date();
  if (period === "WEEKLY") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday.toISOString(), to: sunday.toISOString() };
  }
  if (period === "QUARTERLY") {
    const quarter = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // MONTHLY default
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function getPeriodLabel(
  period: string,
  startDate?: string | null,
  endDate?: string | null
): string {
  if (startDate && endDate) {
    return `${startDate} → ${endDate}`;
  }
  const now = new Date();
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (period === "WEEKLY") return `Sem ${now.getDate()}/${now.getMonth() + 1}`;
  if (period === "QUARTERLY") return `T${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

export async function fetchGoalProgress(supabase: SupabaseClient, goal: any) {
  const { from, to } = getGoalPeriodRange(goal.period, goal.start_date, goal.end_date);
  
  if (goal.goal_type === "Atividades") {
    let q = supabase
      .from("activities")
      .select("id, title, type, date, completed, created_at, user_id, assignee_id")
      .eq("completed", true)
      .gte("created_at", from)
      .lte("created_at", to);

    if (goal.owner_user_id) {
      q = q.or(`user_id.eq.${goal.owner_user_id},assignee_id.eq.${goal.owner_user_id}`);
    }

    const { data: rows } = await q;
    const items = rows ?? [];
    const currentValue = items.length;
    return { currentValue, items };
  }

  // Deal goals
  let q = supabase
    .from("deals")
    .select("id, title, value, status, pipeline_id, owner_id, user_id, created_at, updated_at")
    .is("deleted_at", null);

  if (goal.pipeline_id) {
    q = q.eq("pipeline_id", goal.pipeline_id);
  }

  if (goal.owner_user_id) {
    q = q.or(`owner_id.eq.${goal.owner_user_id},user_id.eq.${goal.owner_user_id}`);
  }

  if (goal.goal_type === "Negócios Adicionados") {
    q = q.gte("created_at", from).lte("created_at", to);
  } else if (goal.goal_type === "Negócios em Andamento") {
    q = q.eq("status", "Ativo");
    if (goal.start_date && goal.end_date) {
      q = q.gte("created_at", from).lte("created_at", to);
    }
  } else if (goal.goal_type === "Negócios Ganhos" || goal.goal_type === "Receita") {
    q = q.eq("status", "Ganho").gte("updated_at", from).lte("updated_at", to);
  }

  const { data: rows } = await q;
  const items = rows ?? [];

  let currentValue = 0;
  if (goal.goal_type === "Receita" || goal.metric === "VALUE") {
    currentValue = items.reduce((acc: number, d: any) => acc + (Number(d.value) || 0), 0);
  } else {
    currentValue = items.length;
  }

  return { currentValue, items };
}

export function exportGoalItemsToCSV(items: any[], goalTitle: string) {
  if (!items || items.length === 0) return;
  const headers = ["Título", "Valor / Tipo", "Status", "Data"];
  const rows = items.map((item) => [
    `"${(item.title || "").replace(/"/g, '""')}"`,
    item.value !== undefined ? item.value : (item.type || "-"),
    item.status || (item.completed ? "Concluída" : "Pendente"),
    new Date(item.created_at || item.date || item.updated_at).toLocaleDateString("pt-BR"),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `meta_${goalTitle.toLowerCase().replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
