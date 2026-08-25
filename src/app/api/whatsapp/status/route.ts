import { NextResponse } from "next/server";
import {
  createAdmin,
  getSessionUser,
  loadConnection,
  resolveWorkspaceId,
  updateConnection,
} from "@/lib/whatsapp/connection";
import { getDriver } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceId(admin, user.id);
  const connection = await loadConnection(admin, ownerId);

  if (!connection || !connection.instanceId) {
    return NextResponse.json({
      status: "disconnected",
      qr: null,
      phoneNumber: null,
      profileName: null,
      signatureEnabled: connection?.signatureEnabled ?? false,
      signatureName: connection?.signatureName ?? null,
      groupsEnabled: connection?.groupsEnabled ?? false,
      isOwner: ownerId === user.id,
      workspaceOwnerId: ownerId,
    });
  }

  let status = connection.status;
  let qr = connection.qrCode;

  // Evolution is the source of truth: our row can be stale if a webhook was
  // missed while the app was down.
  try {
    const live = await getDriver(connection).getStatus();
    if (live !== connection.status) {
      status = live;
      await updateConnection(admin, connection.id, {
        status: live,
        ...(live === "open" ? { qr_code: null, qr_expires_at: null } : {}),
      });
      if (live === "open") qr = null;
    }
  } catch (err) {
    console.error("whatsapp/status: could not reach provider", err);
  }

  // An expired QR is worse than no QR — it silently never scans.
  const qrExpired =
    connection.qrExpiresAt != null && new Date(connection.qrExpiresAt).getTime() < Date.now();

  return NextResponse.json({
    status,
    qr: status === "open" || qrExpired ? null : qr,
    qrExpired: qrExpired && status !== "open",
    phoneNumber: connection.phoneNumber,
    profileName: connection.profileName,
    signatureEnabled: connection.signatureEnabled,
    signatureName: connection.signatureName,
    groupsEnabled: connection.groupsEnabled,
    lastError: connection.lastError ?? null,
    isOwner: ownerId === user.id,
    workspaceOwnerId: ownerId,
  });
}
