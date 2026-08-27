import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SenderSignature {
  enabled: boolean;
  name: string | null;
}

/**
 * Como a mensagem de UMA pessoa deve ser assinada. Devolve null quando não há
 * pessoa (fila de automação), e aí o chamador cai no nome da conexão.
 *
 * O nome vem de workspace_members, nunca de um campo próprio da tabela de
 * preferências: é isso que impede um vendedor assinar como outra pessoa.
 */
export async function loadSenderSignature(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  sentBy: string | null,
): Promise<SenderSignature | null> {
  if (!sentBy) return null;

  const { data: member } = await admin
    .from("workspace_members")
    .select("name, email")
    .eq("workspace_id", workspaceId)
    .eq("member_user_id", sentBy)
    .maybeSingle();

  if (!member) return null;

  const { data: settings } = await admin
    .from("whatsapp_member_settings")
    .select("signature_enabled")
    .eq("workspace_id", workspaceId)
    .eq("user_id", sentBy)
    .maybeSingle();

  // Sem linha de preferência (membro entrou depois do backfill): ligada, que é
  // o default da coluna.
  const enabled = settings?.signature_enabled ?? true;

  // Convite aceito sem nome: usa a parte local do email. Feio, mas assinar com
  // o nome de outra pessoa seria pior.
  const name = member.name?.trim() || member.email?.split("@")[0] || null;

  return { enabled, name };
}
