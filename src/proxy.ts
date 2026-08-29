import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/convite");

  // Cut access the instant a member is removed or suspended, even mid-session.
  // Deleting/suspending only ever touched workspace_members -- it never
  // touched auth.users or the session cookie, so without this check the
  // person keeps a working login until their JWT happens to expire on its
  // own. Every RLS helper (my_workspace_ids, is_ws_admin, ...) already scopes
  // to status = 'accepted', so this SELECT comes back empty via RLS alone for
  // both a suspended row and a deleted one -- no extra status filter needed.
  // O mesmo corte agora também acontece quando o *workspace* (não só o
  // membro) está suspended/deleted -- painel admin muda workspaces.status,
  // e precisa valer imediatamente, não só na próxima vez que a RLS for
  // consultada por outra rota.
  if (user) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id, workspaces(status)")
      .eq("member_user_id", user.id)
      .limit(1);

    // workspaces(status) volta como objeto num embed to-one, mas o gerador
    // de tipos do Supabase às vezes tipa embeds como array -- normaliza os
    // dois formatos em vez de assumir um.
    const rawWorkspace = membership?.[0]?.workspaces as { status: string } | { status: string }[] | null | undefined;
    const workspaceStatus = Array.isArray(rawWorkspace) ? rawWorkspace[0]?.status : rawWorkspace?.status;
    const workspaceShutOff = workspaceStatus === "suspended" || workspaceStatus === "deleted";

    if (!membership || membership.length === 0 || workspaceShutOff) {
      await supabase.auth.signOut();
      const revokedResponse = isAuthPage
        ? response
        : NextResponse.redirect(new URL("/login?revoked=1", request.url));
      // Belt-and-suspenders: clear the session cookie directly on the
      // response we actually return. createMiddlewareClient's `response`
      // closure (see src/lib/supabase/server.ts) only reflects whichever
      // setAll() ran last *before* this function's `response` was
      // destructured -- signOut()'s own cookie clearing can land on a later,
      // discarded copy of that variable, so don't rely on it alone.
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) {
          revokedResponse.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
        }
      }
      return revokedResponse;
    }
  }

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
// api/admin is the platform-admin API (/api/admin/*): Bearer-token or
// session auth inside the route (src/lib/platform-admin-server.ts). Same
// reasoning as api/v1 above -- a script calling with
// PLATFORM_ADMIN_API_TOKEN has no session cookie, so without this exclusion
// it hits the blanket /login redirect and reads the 307 as success.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/admin|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
