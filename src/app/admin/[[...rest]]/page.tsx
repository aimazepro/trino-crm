// O painel mudou de endereço: /admin (dentro do app do cliente) virou
// admin.aimaze.com.br. Este catch-all existe só pra não deixar link antigo
// e bookmark morrerem em 404. Fica FORA de src/app/(crm)/ de propósito --
// não deve carregar o AppShell só pra redirecionar.
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminRedirect({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST;
  // Sem host configurado não há pra onde mandar: 404 é mais honesto do que
  // um redirect pra "https://undefined/".
  //
  // E não pode ser redirect("/"): src/proxy.ts manda um platform admin que
  // cai em "/" de volta pro /admin, então "/" aqui fecha um ciclo e o
  // navegador morre em ERR_TOO_MANY_REDIRECTS. Esse é exatamente o estado da
  // produção entre o deploy e o DNS -- a var ainda não existe e o operador
  // não consegue nem chegar no login.
  //
  // Nota de deploy: NEXT_PUBLIC_* é inlined no build, então definir a var na
  // Vercel só passa a valer depois de um **redeploy** -- salvar a variável
  // sozinha não muda nada no bundle que já está no ar.
  if (!adminHost) notFound();
  const path = rest?.length ? `/${rest.join("/")}` : "/";
  const scheme = adminHost.startsWith("localhost") || adminHost.includes(".localhost") ? "http" : "https";
  redirect(`${scheme}://${adminHost}${path}`);
}
