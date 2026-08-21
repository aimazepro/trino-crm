import { NextRequest, NextResponse } from "next/server";
import {
  createAdmin,
  getSessionUser,
  loadConnectionById,
  resolveWorkspaceId,
} from "@/lib/whatsapp/connection";
import { getDriver } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Groups the given connection belongs to, for the "Avisar grupo no WhatsApp"
 * automation step. Server-side because the instance token never reaches the
 * browser (same reason status/connect/disconnect are routes, not client calls).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId é obrigatório" }, { status: 400 });
  }

  const admin = createAdmin();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  const connection = await loadConnectionById(admin, connectionId);

  // userId on the loaded connection is actually the workspace id (see
  // rowToConnection) -- scoping here so one workspace can't enumerate
  // another's groups by guessing a connection id.
  if (!connection || connection.userId !== workspaceId) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  if (connection.status !== "open") {
    return NextResponse.json(
      { error: "Este WhatsApp não está conectado. Conecte em Configurações > WhatsApp." },
      { status: 409 },
    );
  }

  try {
    const groups = await getDriver(connection).fetchGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("whatsapp/groups", err);
    return NextResponse.json(
      { error: "Não foi possível buscar os grupos. Tente novamente em instantes." },
      { status: 502 },
    );
  }
}
