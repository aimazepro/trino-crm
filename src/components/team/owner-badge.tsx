"use client";

import { cn } from "@/lib/utils";
import { useTeam, getInitials } from "@/hooks/use-team";

interface Props {
  ownerId: string | null | undefined;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}

/**
 * Avatar mais nome de um membro. Um id que não está mais no time (pessoa
 * removida) renderiza "Usuário removido" em vez de string vazia -- registro
 * histórico não deve virar buraco na interface.
 */
export function OwnerBadge({ ownerId, size = "sm", showName = true, className }: Props) {
  const { map, avatars } = useTeam();

  const known = ownerId ? map[ownerId] : undefined;
  const name = ownerId ? (known ?? "Usuário removido") : "Sem dono";
  const avatar = ownerId ? avatars[ownerId] : null;
  const px = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs";

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} title={name}
             className={cn("rounded-full object-cover shrink-0 ring-1 ring-zinc-200", px)} />
      ) : (
        <span title={name}
              className={cn(
                "rounded-full shrink-0 flex items-center justify-center font-extrabold uppercase tracking-tighter ring-1 ring-zinc-200",
                ownerId && known
                  ? "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white"
                  : "bg-zinc-100 text-zinc-400",
                px,
              )}>
          {ownerId && known ? getInitials(name) : "?"}
        </span>
      )}
      {showName && <span className="truncate text-xs text-zinc-600">{name}</span>}
    </span>
  );
}
