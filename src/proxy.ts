import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

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
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/track|api/whatsapp/webhook|api/whatsapp/queue|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
