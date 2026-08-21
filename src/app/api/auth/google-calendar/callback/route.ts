import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/token-crypto";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const queryState = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_calendar_oauth_state")?.value;

  if (error || !code || !cookieState || cookieState !== queryState) {
    console.error("[google-calendar/callback] state/code check failed", {
      googleError: error,
      hasCode: !!code,
      hasCookieState: !!cookieState,
      stateMatch: cookieState === queryState,
    });
    const redirectRes = NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
    redirectRes.cookies.delete("google_calendar_oauth_state");
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
    console.error("[google-calendar/callback] no Supabase user session in callback");
    return NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
  }

  const workspaceCtx = await getWorkspaceContext(supabase);
  if (!workspaceCtx) {
    console.error("[google-calendar/callback] no workspace membership for user", { userId: user.id });
    return NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
  }

  const clientId =
    process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID ||
    process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET ||
    process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    console.error("[google-calendar/callback] missing OAuth credentials in environment");
    return NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    console.error("[google-calendar/callback] token exchange failed", {
      status: tokenRes.status,
      tokens,
    });
    return NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
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

  let refreshToken: string | null = tokens.refresh_token ?? null;
  if (!refreshToken) {
    const { data: existing } = await admin
      .from("integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .maybeSingle();
    refreshToken = existing?.refresh_token ?? null;
  }

  const { error: upsertErr } = await admin.from("integrations").upsert(
    {
      user_id: user.id,
      workspace_id: workspaceCtx.workspaceId,
      provider: "google_calendar",
      account_email: accountEmail,
      access_token: encryptToken(tokens.access_token),
      refresh_token: refreshToken ? encryptToken(refreshToken) : null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      scopes: ["calendar.events", "calendar.readonly", "userinfo.email"],
      active: true,
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertErr) {
    console.error("[google-calendar/callback] integrations upsert failed", {
      userId: user.id,
      error: upsertErr,
    });
    return NextResponse.redirect(
      new URL("/configuracoes/calendario?calendar_error=1", req.url)
    );
  }

  const successRes = NextResponse.redirect(
    new URL(
      `/configuracoes/calendario?calendar_connected=1&email=${encodeURIComponent(accountEmail)}`,
      req.url
    )
  );
  successRes.cookies.delete("google_calendar_oauth_state");
  return successRes;
}
