import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Public endpoint — the invitee has no session yet. The invite_token itself
 * is the credential (random, single-use, expires). service role: validates
 * the token, creates or links the auth user, marks the membership accepted.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: "Dados inválidos (senha precisa de 8+ caracteres)" }, { status: 400 });
  }

  const supabase = admin();

  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("id, workspace_id, email, role, status, invite_expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (memberErr || !member) {
    return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  }
  if (member.status !== "pending") {
    return NextResponse.json({ error: "Convite já foi usado" }, { status: 409 });
  }
  if (member.invite_expires_at && new Date(member.invite_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Convite expirado" }, { status: 410 });
  }

  // Reuse an existing auth user for this email if one exists (e.g. re-invited
  // after being removed); otherwise create a fresh one.
  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users.find(
    (u) => u.email?.toLowerCase() === member.email.toLowerCase()
  );

  let userId: string;
  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, { password });
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
      // full_name, não name: é a chave que o app inteiro lê. Gravar `name`
      // fazia todo convidado aparecer pelo email até alguém notar.
      user_metadata: name ? { full_name: name, name } : undefined,
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? "Falha ao criar usuário" }, { status: 500 });
    }
    userId = created.user.id;
  }

  const { error: updateErr } = await supabase
    .from("workspace_members")
    .update({
      member_user_id: userId,
      name: name || null,
      status: "accepted",
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })
    .eq("id", member.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: member.email });
}
