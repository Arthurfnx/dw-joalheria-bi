import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoEditarProduto } from "@/app/acoes/produtos";
import { Cartao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroNaoEncontrado, ErroValidacao } from "@/servidor/erros";
import { listarOpcoesDeCadastro } from "@/servidor/servicos/cadastros";
import { obterProduto } from "@/servidor/servicos/produtos";
import { hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";
import { FormularioProduto } from "../../formulario-produto";

export const metadata: Metadata = { title: "Editar produto" };

export default async function PaginaEditarProduto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = await exigirAcessoRota(`/produtos/${id}/editar`);
  let dados;
  try {
    dados = await obterProduto(bdAplicacao(), ator, id);
  } catch (e) {
    if (e instanceof ErroNaoEncontrado || e instanceof ErroValidacao) notFound();
    throw e;
  }
  const p = dados.produto;
  const opcoes = await listarOpcoesDeCadastro(bdAplicacao(), ator);

  // RN-11: o item que o produto já usa continua na lista, mesmo desativado.
  const materiais = opcoes.materiais.some((m) => m.id === p.material_id)
    ? opcoes.materiais
    : [...opcoes.materiais, { id: p.material_id, nome: `${p.materialNome} (inativo)`, ativo: false }];
  const categorias = opcoes.categorias.some((c) => c.id === p.categoria_id)
    ? opcoes.categorias
    : [...opcoes.categorias, { id: p.categoria_id, nome: `${p.categoriaNome} (inativa)`, ativo: false, usaTamanho: p.categoriaUsaTamanho }];
  const subcategorias =
    p.subcategoria_id && !opcoes.subcategorias.some((s) => s.id === p.subcategoria_id)
      ? [...opcoes.subcategorias, { id: p.subcategoria_id, nome: `${p.subcategoriaNome} (inativa)`, ativo: false, categoriaId: p.categoria_id, categoriaNome: p.categoriaNome }]
      : opcoes.subcategorias;

  const texto = (v: string | number | null) => (v === null ? "" : String(v));
  return (
    <>
      <Link href={`/produtos/${p.id}`} className="text-sm text-primaria hover:underline">← Voltar ao produto</Link>
      <TituloPagina>Editar {p.codigo}</TituloPagina>
      <Cartao className="max-w-3xl">
        <FormularioProduto
          acao={acaoEditarProduto}
          valores={{
            id: p.id,
            codigo: p.codigo,
            descricao: p.descricao,
            materialId: p.material_id,
            categoriaId: p.categoria_id,
            subcategoriaId: texto(p.subcategoria_id),
            modoControle: p.modo_controle,
            pesoGramas: texto(p.peso_gramas),
            tamanho: texto(p.tamanho),
            pedras: texto(p.pedras),
            precoVenda: texto(p.preco_venda),
            estoqueMinimo: texto(p.estoque_minimo),
            observacao: texto(p.observacao),
            indicePreco: texto(p.indice_preco),
            valorAquisicao: texto(p.valor_aquisicao),
            dataAquisicao: texto(p.data_aquisicao),
            localEstoque: texto(p.local_estoque),
            consignadoCom: texto(p.consignado_com),
          }}
          materiais={materiais}
          categorias={categorias}
          subcategorias={subcategorias}
          novo={false}
          codigoTravado={dados.movimentacoes.length > 0}
          hoje={hojeSaoPaulo()}
        />
      </Cartao>
    </>
  );
}
