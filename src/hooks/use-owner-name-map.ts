"use client";

// Fachada de compatibilidade sobre useTeam. Novas telas devem usar useTeam
// direto -- este arquivo existe só para os consumidores anteriores à
// individualização multiusuário e some quando o último migrar.

import { useTeam, getInitials } from "@/hooks/use-team";

export { getInitials };

export function useOwnerNameMap(): {
  map: Record<string, string>;
  avatars: Record<string, string | null>;
  names: string[];
  selfName: string;
  selfId: string;
} {
  const { map, avatars, members, self } = useTeam();
  return {
    map,
    avatars,
    names: members.map((m) => m.name),
    selfName: self?.name ?? "",
    selfId: self?.id ?? "",
  };
}
