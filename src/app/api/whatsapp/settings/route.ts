import { NextRequest, NextResponse } from "next/server";
import {
  createAdmin,
  getSessionUser,
  loadConnection,
  resolveWorkspaceOwner,
  updateConnection,
} from "@/lib/whatsapp/connection";

export const dynamic = "force-dynamic";

const MAX_SIGNATURE_LENGTH = 40;

/**
 * Writes the signature settings. Owner-only, like connecting and disconnecting:
 * the whole workspace sends through one number, so this changes what every
 * member's messages look like.
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceOwner(admin, user.id);
  if (ownerId !== user.id) {
    return NextResponse.json(
      { error: "Só o dono da conta pode alterar a assinatura." },
      { status: 403 },
    );
  }

  const connection = await loadConnection(admin, ownerId);
  if (!connection) {
    return NextResponse.json({ error: "WhatsApp não configurado." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    signatureEnabled?: unknown;
    signatureName?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.signatureEnabled === "boolean") {
    patch.signature_enabled = body.signatureEnabled;
  }

  if (body.signatureName !== undefined) {
    const name = typeof body.signatureName === "string" ? body.signatureName.trim() : "";
    if (name.length > MAX_SIGNATURE_LENGTH) {
      return NextResponse.json(
        { error: `A assinatura deve ter no máximo ${MAX_SIGNATURE_LENGTH} caracteres.` },
        { status: 400 },
      );
    }
    // Empty clears it, and the account name takes over again.
    patch.signature_name = name || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  // Turning the signature on with no name anywhere would sign nothing, which
  // reads as a broken toggle rather than a deliberate setting.
  const nextEnabled = (patch.signature_enabled as boolean | undefined) ?? connection.signatureEnabled;
  const nextName =
    ("signature_name" in patch ? (patch.signature_name as string | null) : connection.signatureName) ??
    connection.profileName;
  if (nextEnabled && !nextName) {
    return NextResponse.json(
      { error: "Defina um nome para a assinatura antes de ativá-la." },
      { status: 400 },
    );
  }

  await updateConnection(admin, connection.id, patch);

  return NextResponse.json({
    signatureEnabled: nextEnabled,
    signatureName: ("signature_name" in patch
      ? (patch.signature_name as string | null)
      : connection.signatureName),
  });
}
