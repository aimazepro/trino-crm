// Ativacao da telefonia do workspace.
//
// Provedor que sabe criar subconta sozinho (o simulado) e provisionado aqui.
// Provedor sem hierarquia de revenda documentada (API4COM hoje) recebe a
// credencial que o dono informa -- por isso `canSelfProvision` existe.

import { NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import {
  createTelephonyAdmin,
  ensureAccount,
  getSessionUser,
  isWorkspaceOwner,
  resolveWorkspaceId,
  storeCredentials,
  webhookUrlFor,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        action?: string;
        provider?: string;
        apiToken?: string;
        callerId?: string;
        recordingEnabled?: boolean;
        recordingRetentionDays?: number;
        consentMode?: string;
        consentText?: string;
      }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Informe a ação" }, { status: 400 });

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);
    if (!(await isWorkspaceOwner(admin, workspaceId, user.id))) {
      return NextResponse.json(
        { error: "Só o dono da conta pode configurar a telefonia." },
        { status: 403 },
      );
    }

    const account = await ensureAccount(admin, workspaceId);

    if (body.action === "deactivate") {
      await admin
        .from("telephony_accounts")
        .update({ status: "inactive" })
        .eq("id", account.id);
      return NextResponse.json({ status: "inactive" });
    }

    if (body.action === "settings") {
      const patch: Record<string, unknown> = {};
      if (body.callerId !== undefined) patch.caller_id = body.callerId;
      if (body.recordingEnabled !== undefined) patch.recording_enabled = body.recordingEnabled;
      if (body.recordingRetentionDays !== undefined) {
        const days = Number(body.recordingRetentionDays);
        if (!Number.isInteger(days) || days < 1 || days > 3650) {
          return NextResponse.json({ error: "Retenção inválida (1 a 3650 dias)." }, { status: 400 });
        }
        patch.recording_retention_days = days;
      }
      if (body.consentMode && ["announce", "manual", "off"].includes(body.consentMode)) {
        patch.consent_mode = body.consentMode;
      }
      if (body.consentText !== undefined) patch.consent_text = body.consentText.slice(0, 500);

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
      }

      const { data } = await admin
        .from("telephony_accounts")
        .update(patch as never)
        .eq("id", account.id)
        .select("status, caller_id, recording_enabled, recording_retention_days, consent_mode, consent_text")
        .maybeSingle();

      return NextResponse.json({ settings: data });
    }

    if (body.action !== "activate") {
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
    }

    const providerName = body.provider ?? account.provider;
    const provider = getProvider(providerName);

    if (provider.canSelfProvision) {
      const { data: workspace } = await admin
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .maybeSingle();

      const result = await provider.provisionAccount({
        workspaceId,
        workspaceName: workspace?.name ?? "Workspace",
        ownerEmail: user.email,
        // Em ambiente sem URL publica configurada seguimos assim mesmo: o
        // simulado nao faz chamada de rede. Provedor real falha alto aqui, que
        // e o comportamento certo -- webhook sem URL publica nunca chegaria.
        webhookUrl: (() => {
          try {
            return webhookUrlFor(providerName);
          } catch {
            return "";
          }
        })(),
        webhookSecret: account.webhook_secret,
      });

      await storeCredentials(admin, account.id, result.credentials);
      await admin
        .from("telephony_accounts")
        .update({
          provider: providerName,
          provider_account_id: result.providerAccountId,
          caller_id: body.callerId ?? result.callerId ?? account.caller_id,
          status: "active",
          last_error: null,
        })
        .eq("id", account.id);

      return NextResponse.json({ status: "active", provider: providerName });
    }

    // Provedor que exige credencial do dono.
    if (!body.apiToken) {
      return NextResponse.json(
        { error: `O provedor ${providerName} exige o token da sua conta.`, needsToken: true },
        { status: 400 },
      );
    }

    await storeCredentials(admin, account.id, { apiToken: body.apiToken });
    await admin
      .from("telephony_accounts")
      .update({
        provider: providerName,
        caller_id: body.callerId ?? account.caller_id,
        status: "active",
        last_error: null,
      })
      .eq("id", account.id);

    return NextResponse.json({ status: "active", provider: providerName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/account", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
