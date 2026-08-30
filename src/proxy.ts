import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/server";
import { matchesAdminAllowlist } from "@/lib/platform-admin";

// Host do painel da plataforma. NEXT_PUBLIC_ é inlined no build, então dá
// pra ler no escopo do módulo -- e o mesmo valor vale para dev
// (painel.localhost:3000) e produção (admin.aimaze.com.br). O rewrite NÃO é
// desligado em dev de propósito: se fosse, todo link do painel ("/contas")
// resolveria contra o CRM localmente e o painel só seria testável em prod.
const ADMIN_HOST = (process.env.NEXT_PUBLIC_ADMIN_HOST ?? "").toLowerCase();

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // x-forwarded-host primeiro: atrás do proxy da Vercel é ele que carrega o
  // host que o navegador realmente pediu.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  const isPanelHost = !!ADMIN_HOST && host === ADMIN_HOST;

  // Regra 3 (§4 do spec): o painel não é alcançável pelo domínio do cliente.
  // notFound() é API de Server Component e não existe aqui -- 404 na mão.
  // Também 404 no host do painel: lá a URL canônica é limpa ("/contas"), e
  // deixar /painel/contas passar reescreveria pra /painel/painel/contas.
  if (path.startsWith("/painel")) {
    return new NextResponse(null, { status: 404 });
  }

  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  // Regras 1 e 2 (§4): host do painel serve src/app/painel/*, e /api/* passa
  // direto. Sem a exceção do /api, uma chamada do painel pra
  // /api/admin/workspaces viraria /painel/api/admin/workspaces e o painel
  // inteiro quebraria. O getUser() acima roda antes de propósito: é ele que
  // renova o cookie de sessão, e sem renovação a sessão do painel morreria na
  // primeira expiração de token.
  //
  // Nada da lógica de membership do CRM (abaixo) roda no host do painel: um
  // operador não é membro de workspace nenhum, e o gate de verdade é
  // src/app/painel/(app)/layout.tsx.
  if (isPanelHost) {
    if (path.startsWith("/api")) return response;
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? "/painel" : `/painel${path}`;
    const rewritten = NextResponse.rewrite(url);
    for (const cookie of response.cookies.getAll()) rewritten.cookies.set(cookie);
    return rewritten;
  }

  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/convite");

  // Um platform admin não é necessariamente membro de workspace nenhum (é o
  // mesmo motivo que já tirou /admin do matcher abaixo) -- sem essa isenção,
  // todo login de admin puro batia em "sem membership = revogado" na primeira
  // request pra "/" (destino padrão do login), era deslogado na hora e voltava
  // pro /login?revoked=1 num loop silencioso. Reproduzido ao vivo 2026-08-29:
  // tools@trinocompany.com.br logava com sucesso e nunca saía do /login.
  const isPlatformAdmin = matchesAdminAllowlist(user?.email, process.env.PLATFORM_ADMIN_EMAILS);

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
  if (user && !isPlatformAdmin) {
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
    return NextResponse.redirect(new URL(isPlatformAdmin ? "/admin" : "/", request.url));
  }

  // Home genérica ("/") pressupõe workspace -- um admin puro não tem um, então
  // manda direto pro painel dele em vez de deixar "/" quebrar em silêncio.
  if (user && isPlatformAdmin && path === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
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
// admin (the UI, /admin/*) is excluded for a different reason: a platform
// admin is not necessarily a member of any workspace, so the block below
// (kick out any session with zero workspace_members rows) was firing for
// them before they ever reached src/app/admin/layout.tsx's own
// getPlatformAdminFromSession() gate -- reproduced live 2026-08-29, a fresh
// platform-admin account with no workspace membership got bounced to
// /login?revoked=1 on every /admin visit. The layout's own gate is the real
// protection here (session + email allowlist), same as api/admin's route
// gate is the real protection for the API side.
// api/auth/impersonate é o callback de "entrar como cliente": chega SEM
// cookie de sessão (é exatamente ele que vai criar a sessão, trocando um
// token de uso único). Sem esta exclusão levava 307 pro /login e o
// impersonate nunca funcionava -- mesma armadilha de api/cron e
// api/telephony/webhook, que já custou 3 incidentes neste projeto.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/gmail/callback|api/auth/google-calendar/callback|api/auth/impersonate|api/track|api/whatsapp/webhook|api/whatsapp/queue|api/telephony/webhook|api/convites|api/automations|api/v1|api/admin|admin|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
