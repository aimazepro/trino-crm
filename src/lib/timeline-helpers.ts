import {
  RotateCcw, Pencil, Trophy, CircleX, User, Building2,
  ArrowRight, Plus, CheckCircle2, CalendarPlus, Trash2,
  FileText, GitMerge, DollarSign, Tag, Package, CalendarDays, Mail,
  type LucideIcon
} from "lucide-react";

export type TimelineIconConfig = {
  icon: LucideIcon;
  badgeClass: string;
};

export function getTimelineIconConfig(description: string): TimelineIconConfig {
  const desc = (description || "").toLowerCase().trim();

  // 1. IMPORTANT COLORED EVENTS (HIGHLIGHTED)
  if (desc.includes("ganho") || desc.includes("marcado como ganho")) {
    return { icon: Trophy, badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200/60" };
  }
  if (desc.includes("perdido") || desc.includes("marcado como perdido")) {
    return { icon: CircleX, badgeClass: "bg-red-50 text-red-600 border-red-200/60" };
  }
  if (desc.includes("concluída") || desc.includes("concluida")) {
    return { icon: CheckCircle2, badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200/60" };
  }

  // 2. SPECIFIC NEUTRAL EVENTS WITH CUSTOM ICONS PER SITUATION
  if (desc.includes("reaberto") || desc.includes("restaurado")) {
    return { icon: RotateCcw, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.includes("criado")) {
    return { icon: Plus, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.includes("excluído") || desc.includes("excluido") || desc.includes("removid")) {
    return { icon: Trash2, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.includes("mesclado")) {
    return { icon: GitMerge, badgeClass: "bg-purple-50 text-purple-600 border-purple-200/60" };
  }
  if (desc.startsWith("contato")) {
    return { icon: User, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("empresa")) {
    return { icon: Building2, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (
    desc.startsWith("título") ||
    desc.startsWith("titulo") ||
    desc.includes("nome alterado")
  ) {
    return { icon: Pencil, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("valor")) {
    return { icon: DollarSign, badgeClass: "bg-amber-50 text-amber-600 border-amber-200/60" };
  }
  if (desc.startsWith("previsão") || desc.startsWith("previsao") || desc.startsWith("data")) {
    return { icon: CalendarDays, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("etiqueta") || desc.includes("tag")) {
    return { icon: Tag, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("produto")) {
    return { icon: Package, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("nota")) {
    return { icon: FileText, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.startsWith("email")) {
    return { icon: Mail, badgeClass: "bg-blue-50 text-blue-600 border-blue-200/60" };
  }
  if (desc.includes("atividade criada")) {
    return { icon: CalendarPlus, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }
  if (desc.includes("etapa") || desc.includes("pipeline")) {
    return { icon: ArrowRight, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
  }

  // Fallback icon for any other update
  return { icon: Pencil, badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200/60" };
}
