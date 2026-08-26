// Desvincular ramal e trocar o modo de cobranca. Ambos so pelo dono.

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/telephony";
import type { TelephonyExtensionRow } from "@/lib/telephony/db";
import {
  createTelephonyAdmin,
  credentialsOf,
  ensureAccount,
  getSessionUser,
  isPaidPlan,
  isWorkspaceOwner,
  publicExtension,
  resolveWorkspaceId,
} from "@/lib/telephony/server";

export const dynamic = "force-dynamic";

async function ownerGuard(userId: string) {
  const admin = createTelephonyAdmin();
  const workspaceId = await resolveWorkspaceId(admin, userId);
  const owner = await isWorkspaceOwner(admin, workspaceId, userId);
  return { admin, workspaceId, owner };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { mode?: string; dialMode?: string; callbackNumber?: string | null }
    | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  try {
    const { admin, workspaceId, owner } = await ownerGuard(user.id);
    if (!owner) {
      return NextResponse.json({ error: "Só o dono da conta pode alterar ramais." }, { status: 403 });
    }

    const patch: Partial<TelephonyExtensionRow> = {};

    if (body.mode === "unlimited" || body.mode === "per_minute") {
      if (body.mode === "unlimited") {
        const { data: workspace } = await admin
          .from("workspaces")
          .select("plan")
          .eq("id", workspaceId)
          .maybeSingle();
        if (!isPaidPlan(workspace?.plan)) {
          return NextResponse.json(
            { error: "O modo ilimitado exige plano pago." },
            { status: 402 },
          );
        }
      }
      patch.mode = body.mode;
    }
    if (body.dialMode === "webphone" || body.dialMode === "callback") {
      patch.dial_mode = body.dialMode;
    }
    if (body.callbackNumber !== undefined) patch.callback_number = body.callbackNumber;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("telephony_extensions")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Ramal não encontrado" }, { status: 404 });

    return NextResponse.json({ extension: publicExtension(data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/extensions PATCH", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  try {
    const { admin, workspaceId, owner } = await ownerGuard(user.id);
    if (!owner) {
      return NextResponse.json({ error: "Só o dono da conta pode desvincular." }, { status: 403 });
    }

    const { data: ext } = await admin
      .from("telephony_extensions")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!ext) return NextResponse.json({ error: "Ramal não encontrado" }, { status: 404 });

    // Solta o ramal no provedor antes de apagar aqui. Se o provedor recusar,
    // paramos: apagar so do nosso lado deixaria credencial viva sem dono.
    const account = await ensureAccount(admin, workspaceId);
    if (ext.provider_credential_id) {
      await getProvider(account.provider).deleteExtension({
        credentials: credentialsOf(account),
        credentialId: ext.provider_credential_id,
      });
    }

    await admin.from("telephony_extensions").delete().eq("id", ext.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("telephony/extensions DELETE", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
