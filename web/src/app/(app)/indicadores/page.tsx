import type { Metadata } from "next";
import { TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { recomendarFormato } from "@/servidor/recomendacao-formato";
import { estoquePor, vendasPorMes } from "@/servidor/servicos/indicadores";
import { exigirAcessoRota } from "@/web/sessao";
import { PainelIndicadores } from "./painel-indicadores";

export const metadata: Metadata = { title: "Indicadores" };

export default async function PaginaIndicadores() {
  // RN-115: administrador e vendedor; nenhuma consulta lê custo.
  const ator = await exigirAcessoRota("/indicadores");
  const bd = bdAplicacao();
  const [vendas, categorias, materiais] = await Promise.all([
    vendasPorMes(bd, ator),
    estoquePor(bd, ator, "categoria"),
    estoquePor(bd, ator, "material"),
  ]);
  // RN-111: categoria é comparação entre itens; material, composição do estoque.
  const recomendacoes = {
    vendas: recomendarFormato("SERIE_TEMPORAL", vendas.meses.length),
    categorias: recomendarFormato("COMPARACAO", categorias.itens.length),
    materiais: recomendarFormato("COMPOSICAO", materiais.itens.length),
  };
  return (
    <>
      <TituloPagina descricao="Visão rápida dos principais números. Escolha o formato de cada indicador; o recomendado já vem marcado.">
        Indicadores
      </TituloPagina>
      <PainelIndicadores vendas={vendas} categorias={categorias} materiais={materiais} recomendacoes={recomendacoes} />
    </>
  );
}
