// Token efemero do webphone.
//
// A credencial SIP permanente nao fica guardada no navegador: cada sessao de
// discagem pede um token aqui, e a rota reconfere sessao, ramal ativo e saldo
// antes de emitir.

import { NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import {
  createTelephonyAdmin,
  credentialsOf,
  extensionSipPassword,
  getSessionUser,
  loadAccount,
  loadExtensionForUser,
  resolveWorkspaceId,
} from "@/lib/telephony/server";
import { assertFeatureEnabled } from "@/lib/feature-flags-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createTelephonyAdmin();

  try {
    const workspaceId = await resolveWorkspaceId(admin, user.id);

    const featureCheck = await assertFeatureEnabled(admin, workspaceId, "voip");
    if (!featureCheck.ok) return featureCheck.response;

    const account = await loadAccount(admin, workspaceId);
    if (!account || account.status !== "active") {
      return NextResponse.json({ error: "Telefonia não está ativa." }, { status: 409 });
    }

    const ext = await loadExtensionForUser(admin, workspaceId, user.id);
    if (!ext || ext.status !== "active") {
      return NextResponse.json({ error: "Sem ramal vinculado." }, { status: 403 });
    }

    if (ext.mode === "per_minute") {
      const { data: bal } = await admin
        .from("telephony_balances")
        .select("balance_cents, reserved_cents")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if ((bal?.balance_cents ?? 0) - (bal?.reserved_cents ?? 0) <= 0) {
        return NextResponse.json(
          { error: "Saldo zerado. Adicione créditos para ligar.", reason: "insufficient_balance" },
          { status: 402 },
        );
      }
    }

    const token = await getProvider(account.provider).issueWebphoneToken({
      credentials: credentialsOf(account),
      extension: ext.extension,
      sipUsername: ext.sip_username ?? ext.extension,
      sipPassword: extensionSipPassword(ext),
      sipServer: ext.sip_server ?? "",
    });

    return NextResponse.json(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/token", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
