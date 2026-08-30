// src/app/api/auth/impersonate/route.ts
//
// Chamada de máquina sem cookie: está na lista de exclusões do matcher em
// src/proxy.ts de propósito. Sem isso levaria 307 pro /login e o
// impersonate nunca aconteceria (a mesma armadilha de api/cron).
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const email = searchParams.get("email");

  if (!tokenHash || !email) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const response = NextResponse.redirect(`${origin}/`);
  // NÃO httpOnly de propósito: a faixa é um componente de cliente e o valor
  // é só um e-mail -- não é credencial, não é fronteira de segurança. A
  // fronteira é o cookie de sessão do Supabase, que continua httpOnly.
  response.cookies.set("impersonated_by", email, {
    path: "/",
    sameSite: "lax",
    // O marcador tem que viver PELO MENOS o tempo da sessão que ele
    // descreve, senão a faixa some antes do acesso emprestado acabar --
    // 8h deixava a sessão do Supabase (criada pelo verifyOtp() logo acima,
    // com o Max-Age default da lib) viva bem depois do aviso visual ter
    // expirado sozinho, sem nenhuma falha envolvida. 34560000s (~400 dias)
    // é o mesmo Max-Age que esse cookie de sessão usa neste projeto; se um
    // dia a validade do cookie de sessão do Supabase mudar, este número
    // muda junto.
    maxAge: 34560000,
  });
  return response;
}
