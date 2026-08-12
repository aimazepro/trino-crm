import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const queryState = req.nextUrl.searchParams.get("state");

  const calendarCookieState = req.cookies.get("google_calendar_oauth_state")?.value;
  const gmailCookieState = req.cookies.get("gmail_oauth_state")?.value;

  const isCalendar = !!calendarCookieState && calendarCookieState === queryState;
  const isGmail = !!gmailCookieState && gmailCookieState === queryState;

  if (error || !code || (!isCalendar && !isGmail)) {
    console.error("[auth/callback] state/code check failed", {
      googleError: error,
      hasCode: !!code,
      calendarMatch: isCalendar,
      gmailMatch: isGmail,
    });

    const errorRedirect = isCalendar
      ? new URL("/configuracoes/calendario?calendar_error=1", req.url)
      : new URL("/configuracoes/integracoes?gmail=error", req.url);

    const redirectRes = NextResponse.redirect(errorRedirect);
    redirectRes.cookies.delete("google_calendar_oauth_state");
    redirectRes.cookies.delete("gmail_oauth_state");
    return redirectRes;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore in read-only context
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[auth/callback] no Supabase user session in callback");
    const errorUrl = isCalendar
      ? "/configuracoes/calendario?calendar_error=1"
      : "/configuracoes/integracoes?gmail=error";
    return NextResponse.redirect(new URL(errorUrl, req.url));
  }

  const clientId =
    (isCalendar
      ? process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID
      : process.env.GMAIL_OAUTH_CLIENT_ID) ||
    process.env.GMAIL_OAUTH_CLIENT_ID;

  const clientSecret =
    (isCalendar
      ? process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET
      : process.env.GMAIL_OAUTH_CLIENT_SECRET) ||
    process.env.GMAIL_OAUTH_CLIENT_SECRET;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    console.error("[auth/callback] token exchange failed", {
      status: tokenRes.status,
      error: tokens.error,
      error_description: tokens.error_description,
      redirect_uri: redirectUri,
    });
    const errorUrl = isCalendar
      ? "/configuracoes/calendario?calendar_error=1"
      : "/configuracoes/integracoes?gmail=error";
    return NextResponse.redirect(new URL(errorUrl, req.url));
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const accountEmail = profile.email || "usuario@gmail.com";

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const provider = isCalendar ? "google_calendar" : "gmail";

  let refreshToken: string | null = tokens.refresh_token ?? null;
  if (!refreshToken) {
    const { data: existing } = await admin
      .from("integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();
    refreshToken = existing?.refresh_token ?? null;
  }

  await admin.from("integrations").upsert(
    {
      user_id: user.id,
      provider,
      account_email: accountEmail,
      access_token: encryptToken(tokens.access_token),
      refresh_token: refreshToken ? encryptToken(refreshToken) : null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      scopes: isCalendar
        ? ["calendar.events", "calendar.readonly", "userinfo.email"]
        : ["gmail.send", "userinfo.email"],
      active: true,
    },
    { onConflict: "user_id,provider" }
  );

  const successUrl = isCalendar
    ? `/configuracoes/calendario?calendar_connected=1&email=${encodeURIComponent(accountEmail)}`
    : `/configuracoes/gmail?gmail=connected`;

  const successRes = NextResponse.redirect(new URL(successUrl, req.url));
  if (isCalendar) {
    successRes.cookies.delete("google_calendar_oauth_state");
  } else {
    successRes.cookies.delete("gmail_oauth_state");
  }
  return successRes;
}
