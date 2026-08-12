import { NextResponse } from "next/server";

export async function GET() {
  const clientId =
    process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID ||
    process.env.GMAIL_OAUTH_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Default to /api/auth/gmail/callback if no dedicated calendar redirect URI is defined,
  // preventing redirect_uri_mismatch errors when using pre-approved Google Client IDs.
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${appUrl}/api/auth/gmail/callback`;
  const state = crypto.randomUUID();

  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth Client ID is not configured." },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set("google_calendar_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return response;
}
