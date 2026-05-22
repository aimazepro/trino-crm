import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL + "/api/auth/gmail/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
