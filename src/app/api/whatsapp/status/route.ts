import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdmin, loadConnection, updateConnection } from "@/lib/whatsapp/connection";
import { getDriver } from "@/lib/whatsapp";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const ctx = await getWorkspaceContext(supabase);
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdmin();
  const ownerId = ctx.workspaceId;
  const connection = await loadConnection(admin, ownerId);

  // Vendedor agora chama esta rota em toda visita a /configuracoes/whatsapp
  // (a Task 10 abriu a tela para todos os papéis). QR, erro interno e o id
  // bruto do workspace ficam de fora da resposta para quem não administra a
  // conexão: o QR é o código de pareamento AO VIVO do número da empresa —
  // quem o lê no devtools pareia um aparelho próprio, sem precisar de mais
  // nada. Isso é escalonamento de privilégio, não só exibição indevida, então
  // a chave é omitida (não mandada como null) para não vazar no payload.
  const canSeeConnectionSecrets = ctx.role === "admin" || ctx.role === "gerente";

  // Preferência pessoal de quem está pedindo, não do dono da conta: cada
  // membro assina do seu jeito.
  const { data: myMember } = await admin
    .from("workspace_members")
    .select("name, email")
    .eq("workspace_id", ownerId)
    .eq("member_user_id", ctx.userId)
    .maybeSingle();
  const { data: mySettings } = await admin
    .from("whatsapp_member_settings")
    .select("signature_enabled")
    .eq("workspace_id", ownerId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const mySignatureEnabled = mySettings?.signature_enabled ?? true;
  const mySignatureName = myMember?.name?.trim() || myMember?.email?.split("@")[0] || null;

  if (!connection || !connection.instanceId) {
    const base = {
      status: "disconnected",
      phoneNumber: null,
      profileName: null,
      signatureEnabled: connection?.signatureEnabled ?? false,
      signatureName: connection?.signatureName ?? null,
      groupsEnabled: connection?.groupsEnabled ?? false,
      // Sobre o próprio requisitante, não sobre a conexão -- precisa valer
      // para todos, é o que a tela usa para decidir o que MOSTRAR.
      isOwner: ownerId === ctx.userId,
      mySignatureEnabled,
      mySignatureName,
    };
    if (!canSeeConnectionSecrets) return NextResponse.json(base);
    return NextResponse.json({ ...base, qr: null, workspaceOwnerId: ownerId });
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

  const base = {
    status,
    phoneNumber: connection.phoneNumber,
    profileName: connection.profileName,
    signatureEnabled: connection.signatureEnabled,
    signatureName: connection.signatureName,
    groupsEnabled: connection.groupsEnabled,
    isOwner: ownerId === ctx.userId,
    mySignatureEnabled,
    mySignatureName,
  };

  if (!canSeeConnectionSecrets) return NextResponse.json(base);

  return NextResponse.json({
    ...base,
    qr: status === "open" || qrExpired ? null : qr,
    qrExpired: qrExpired && status !== "open",
    lastError: connection.lastError ?? null,
    workspaceOwnerId: ownerId,
  });
}
