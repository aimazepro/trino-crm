import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emailId } = await req.json();
  if (!emailId) return NextResponse.json({ error: "Missing emailId" }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: emailData } = await admin
    .from("emails")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", emailId)
    .eq("user_id", user.id)
    .is("opened_at", null)
    .select("user_id, to_email, subject, deal_id")
    .maybeSingle();

  if (emailData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = emailData as any;
    await admin
      .from("notifications")
      .insert({
        user_id: row.user_id,
        type: "email_open",
        title: `${row.to_email || "Destinatário"} abriu seu email`,
        subtext: row.subject || "",
        href: row.deal_id ? `/negocios/${row.deal_id}?tab=gmail` : "/atividades",
        read: false
      });
  }

  return NextResponse.json({ success: true });
}
