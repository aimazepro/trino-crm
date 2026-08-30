import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";

// NÃO passe `domain` nas opções de cookie aqui. O @supabase/ssr grava o
// cookie host-only, e é só isso que mantém a sessão do painel
// (admin.aimaze.com.br) separada da sessão do CRM (api-crm.aimaze.com.br).
// Um `domain: ".aimaze.com.br"` faria as duas se enxergarem -- em silêncio,
// sem erro nenhum, com o operador logado no CRM de todo cliente.
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
