import { Navegacao } from "@/componentes/navegacao";
import { itensDoMenu } from "@/web/menu";
import { exigirAtor } from "@/web/sessao";

// O layout monta a navegação; a permissão de cada tela é conferida pela própria página.
export default async function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  const ator = await exigirAtor();
  return (
    <div className="md:flex">
      <Navegacao itens={itensDoMenu(ator.perfil)} nome={ator.nome} perfil={ator.perfil} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
