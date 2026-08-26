import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/convite");

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

// Machine callers are excluded here because they carry their own credential and
// have no session cookie: without the exclusion the session check answers a
// redirect to /login, which a webhook or a cron job reads as a successful 307
// and never retries. api/whatsapp/queue is pg_cron; it authenticates with
// AUTOMATION_DISPATCH_SECRET inside the route.
// api/v1 is the public API: Bearer-key auth inside the route (see
// src/lib/api-auth.ts), no session cookie -- same reasoning as
// api/whatsapp/webhook and api/automations above.
// api/auth/gmail/callback and api/auth/google-calendar/callback do their own
// getUser() check and redirect to a friendly *_error=1 page on failure -- but
// the actual route paths never matched the old "api/auth/callback" exclusion
// (no route has ever lived at that literal path), so any request that arrived
// without a live session cookie hit the middleware's blanket /login redirect
// first, dumping the user on a blank login page mid-OAuth-flow instead of the
// route's own error handling.
// api/cron is pg_cron too (calendar-pull, Fase 0 item 4): same shape as
// api/whatsapp/queue above. Was missing from this list until 2026-08-21 --
// the route's own CRON_SECRET check was dead code, every call got a 307 to
// /login before ever reaching it. Caught before the cron job was scheduled,
// not after.
// api/telephony/webhook is the carrier posting call events: no session cookie,
// authenticates by HMAC signature inside the route against the account's
// webhook_secret. Same failure mode as api/cron above -- a 307 to /login reads
// as success to the carrier, so the hangup event never arrives, the call never
// finalizes, and the minute is never billed. Note this excludes ONLY the
// webhook subpath: every other api/telephony route is session-based and must
// keep going through the check.
// api/convites is excluded wholesale, not just the aceitar subpath: the
// invitee has no session cookie when the /convite/[token] page calls
// GET /api/convites/[token] to look up the invite, so that request hit the
// same blanket /login redirect too -- the page's fetch().json() then choked
// on the login page's HTML and surfaced as "Não deu para verificar o convite
// agora" instead of the actual lookup result. POST /api/convites (create)
// rides along in the exclusion but stays safe: it does its own auth via
// getWorkspaceContext(supabase) and 401s/403s without the proxy's help.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
