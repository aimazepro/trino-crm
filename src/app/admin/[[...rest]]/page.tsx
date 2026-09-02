// O painel mudou de endereço: /admin (dentro do app do cliente) virou
// admin.aimaze.com.br. Este catch-all existe só pra não deixar link antigo
// e bookmark morrerem em 404. Fica FORA de src/app/(crm)/ de propósito --
// não deve carregar o AppShell só pra redirecionar.
import { redirect } from "next/navigation";

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
  if (!adminHost) redirect("/");
  const path = rest?.length ? `/${rest.join("/")}` : "/";
  const scheme = adminHost.startsWith("localhost") || adminHost.includes(".localhost") ? "http" : "https";
  redirect(`${scheme}://${adminHost}${path}`);
}
