import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "Missing contactId" }, { status: 400 });

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

  const { data: emails } = await supabase
    .from("emails")
    .select("id, direction, subject, body_html, from_email, to_email, opened_at, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ emails: emails ?? [] });
}
