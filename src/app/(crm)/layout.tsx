// O AppShell (sidebar, Topbar, CrmProvider) vale para o CRM do cliente e só
// para ele. Ficava no root layout, o que embrulhava TODA rota do projeto --
// inclusive o painel da plataforma, que é outro produto em outro host.
//
// A separação é por route group, não por pathname: o proxy reescreve
// admin.aimaze.com.br/contas -> /painel/contas, e usePathname() devolve a URL
// *visível* ("/contas"), então nenhuma checagem de caminho dentro do AppShell
// conseguiria distinguir painel de CRM.
import { AppShell } from "@/components/layout/app-shell";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
