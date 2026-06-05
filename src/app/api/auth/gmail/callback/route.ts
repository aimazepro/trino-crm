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
  const cookieState = req.cookies.get("gmail_oauth_state")?.value;

  if (error || !code || !cookieState || cookieState !== queryState) {
    console.error("[gmail/callback] state/code check failed", {
      googleError: error,
      hasCode: !!code,
      hasCookieState: !!cookieState,
      stateMatch: cookieState === queryState,
    });
    const redirectRes = NextResponse.redirect(
      new URL("/configuracoes/integracoes?gmail=error", req.url)
    );
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("[gmail/callback] no Supabase user session in callback");
    return NextResponse.redirect(
      new URL("/configuracoes/integracoes?gmail=error", req.url)
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
      client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL + "/api/auth/gmail/callback",
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    console.error("[gmail/callback] token exchange failed", {
      status: tokenRes.status,
      error: tokens.error,
      error_description: tokens.error_description,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL + "/api/auth/gmail/callback",
    });
    return NextResponse.redirect(
      new URL("/configuracoes/integracoes?gmail=error", req.url)
    );
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Google only returns refresh_token on the first authorization. On reconnect
  // it will be missing — preserve the existing one instead of overwriting with null.
  let refreshToken: string | null = tokens.refresh_token ?? null;
  if (!refreshToken) {
    const { data: existing } = await admin
      .from("integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle();
    refreshToken = existing?.refresh_token ?? null;
  }

  await admin.from("integrations").upsert(
    {
      user_id: user.id,
      provider: "gmail",
      account_email: profile.email,
      access_token: encryptToken(tokens.access_token),
      refresh_token: refreshToken ? encryptToken(refreshToken) : null,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: ["gmail.send", "userinfo.email"],
      active: true,
    },
    { onConflict: "user_id,provider" }
  );

  const successRes = NextResponse.redirect(
    new URL(`/configuracoes/gmail?gmail=connected`, req.url)
  );
  successRes.cookies.delete("gmail_oauth_state");
  return successRes;
}
