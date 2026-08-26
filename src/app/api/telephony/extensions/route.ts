// Vincular ramal. So o dono do workspace vincula e desvincula -- e o dono quem
// paga a conta, entao e ele quem decide quem gasta.

import { NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import {
  createTelephonyAdmin,
  credentialsOf,
  ensureAccount,
  getSessionUser,
  isPaidPlan,
  isWorkspaceOwner,
  publicExtension,
  resolveWorkspaceId,
  storeExtensionSecret,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { userId?: string; mode?: string; extension?: string }
    | null;
  if (!body?.userId) {
    return NextResponse.json({ error: "Informe o usuário" }, { status: 400 });
  }

  const mode = body.mode === "unlimited" ? "unlimited" : "per_minute";
  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);
    if (!(await isWorkspaceOwner(admin, workspaceId, user.id))) {
      return NextResponse.json(
        { error: "Só o dono da conta pode vincular ramais." },
        { status: 403 },
      );
    }

    // O alvo precisa ser membro aceito deste workspace.
    const { data: member } = await admin
      .from("workspace_members")
      .select("member_user_id, name, email")
      .eq("workspace_id", workspaceId)
      .eq("member_user_id", body.userId)
      .eq("status", "accepted")
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Usuário não faz parte do workspace." }, { status: 404 });
    }

    const { data: workspace } = await admin
      .from("workspaces")
      .select("plan")
      .eq("id", workspaceId)
      .maybeSingle();

    // Ilimitado ocupa vaga do plano; por minuto e pre-pago e vale em qualquer plano.
    if (mode === "unlimited" && !isPaidPlan(workspace?.plan)) {
      return NextResponse.json(
        { error: "O modo ilimitado exige plano pago. Assine o CRM para liberar." },
        { status: 402 },
      );
    }

    const account = await ensureAccount(admin, workspaceId);
    const provider = getProvider(account.provider);

    const created = await provider.createExtension({
      providerAccountId: account.provider_account_id ?? "",
      credentials: credentialsOf(account),
      userId: body.userId,
      userName: member.name ?? member.email,
      preferredExtension: body.extension,
    });

    const { data: row, error } = await admin
      .from("telephony_extensions")
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: body.userId,
          extension: created.extension,
          provider_credential_id: created.credentialId,
          sip_username: created.sipUsername,
          sip_server: created.sipServer,
          mode,
          status: "active",
          linked_by: user.id,
          linked_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,user_id" },
      )
      .select("*")
      .single();

    if (error || !row) {
      return NextResponse.json(
        { error: `Falha ao salvar o ramal: ${error?.message ?? "sem retorno"}` },
        { status: 500 },
      );
    }

    if (created.sipPassword) {
      await storeExtensionSecret(admin, row.id, created.sipPassword);
    }

    return NextResponse.json({ extension: publicExtension(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/extensions POST", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
