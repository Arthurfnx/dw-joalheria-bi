import type { Metadata } from "next";
import Link from "next/link";
import { acaoCriarProduto } from "@/app/acoes/produtos";
import { Cartao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { listarOpcoesDeCadastro } from "@/servidor/servicos/cadastros";
import { hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";
import { FormularioProduto, PRODUTO_VAZIO } from "../formulario-produto";

export const metadata: Metadata = { title: "Novo produto" };

export default async function PaginaNovoProduto() {
  const ator = await exigirAcessoRota("/produtos/novo");
  // RN-11: só itens ativos para novos cadastros.
  const opcoes = await listarOpcoesDeCadastro(bdAplicacao(), ator);
  return (
    <>
      <Link href="/produtos" className="text-sm text-primaria hover:underline">← Produtos</Link>
      <TituloPagina>Novo produto</TituloPagina>
      <Cartao className="max-w-3xl">
        <FormularioProduto
          acao={acaoCriarProduto}
          valores={PRODUTO_VAZIO}
          materiais={opcoes.materiais}
          categorias={opcoes.categorias}
          subcategorias={opcoes.subcategorias}
          novo
          codigoTravado={false}
          hoje={hojeSaoPaulo()}
        />
      </Cartao>
    </>
  );
}
