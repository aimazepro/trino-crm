import { NextResponse } from "next/server";
import {
  createAdmin,
  getSessionUser,
  loadConnection,
  resolveWorkspaceOwner,
  updateConnection,
} from "@/lib/whatsapp/connection";
import { getDriver } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceOwner(admin, user.id);

  if (ownerId !== user.id) {
    return NextResponse.json(
      { error: "Só o dono da conta pode desconectar o WhatsApp do workspace." },
      { status: 403 },
    );
  }

  const connection = await loadConnection(admin, ownerId);
  if (!connection) return NextResponse.json({ status: "disconnected" });

  try {
    await getDriver(connection).logout();
  } catch (err) {
    // A session that is already gone on Evolution's side still has to be marked
    // disconnected here, or the UI stays stuck on "conectado".
    console.error("whatsapp/disconnect: logout failed", err);
  }

  await updateConnection(admin, connection.id, {
    status: "disconnected",
    qr_code: null,
    qr_expires_at: null,
    phone_number: null,
    profile_name: null,
    profile_pic_url: null,
  });

  return NextResponse.json({ status: "disconnected" });
}
