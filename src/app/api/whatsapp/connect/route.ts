import { NextResponse } from "next/server";
import {
  createAdmin,
  ensureConnection,
  getSessionUser,
  resolveWorkspaceOwner,
  storeInstanceToken,
  updateConnection,
  webhookUrlFor,
} from "@/lib/whatsapp/connection";
import { getDriver } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const QR_TTL_MS = 40_000;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = await resolveWorkspaceOwner(admin, user.id);

  // Members of someone else's workspace share the owner's instance and must not
  // be able to reconnect (or re-pair) it from their own screen.
  if (ownerId !== user.id) {
    return NextResponse.json(
      { error: "Só o dono da conta pode conectar o WhatsApp do workspace." },
      { status: 403 },
    );
  }

  try {
    const connection = await ensureConnection(admin, ownerId, user.email);
    const driver = getDriver(connection);
    const webhookUrl = webhookUrlFor(connection.id);

    if (!connection.instanceId) {
      try {
        const created = await driver.createInstance(webhookUrl, connection.webhookSecret);
        await storeInstanceToken(admin, connection.id, created.instanceToken);
        await updateConnection(admin, connection.id, {
          instance_id: created.instanceId,
          status: "connecting",
          qr_code: created.qr.base64,
          qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
          last_error: null,
        });

        return NextResponse.json({ status: "connecting", qr: created.qr.base64 });
      } catch (err) {
        // The instance can already exist on Evolution while our row lost track
        // of it (a failed write, a restored backup). Adopt it instead of dying.
        const message = err instanceof Error ? err.message : String(err);
        const alreadyThere = /already in use|already exists|is not unique/i.test(message);
        if (!alreadyThere) throw err;
      }
    }

    // Re-asserting the webhook on every connect keeps the URL and the secret
    // current even if the app moved domains.
    await driver.setWebhook(webhookUrl, connection.webhookSecret);

    const state = await driver.getStatus();
    if (state === "open") {
      await updateConnection(admin, connection.id, {
        status: "open",
        qr_code: null,
        qr_expires_at: null,
        last_error: null,
      });
      return NextResponse.json({ status: "open", qr: null });
    }

    const qr = await driver.getQr();
    await updateConnection(admin, connection.id, {
      status: "connecting",
      qr_code: qr.base64,
      qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
      last_error: null,
    });

    return NextResponse.json({ status: "connecting", qr: qr.base64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar";
    console.error("whatsapp/connect", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
