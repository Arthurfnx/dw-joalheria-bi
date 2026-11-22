import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Botao, Campo, Cartao, Etiqueta, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroValidacao } from "@/servidor/erros";
import { temPermissao } from "@/servidor/permissoes";
import { listarOpcoesDeCadastro } from "@/servidor/servicos/cadastros";
import { buscarProdutos, LIMITE_BUSCA_PRODUTOS, LOCAIS_ESTOQUE, type ProdutoDaLista } from "@/servidor/servicos/produtos";
import { formatarReais } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Produtos" };

type Parametros = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaProdutos({ searchParams }: { searchParams: Promise<Parametros> }) {
  const ator = await exigirAcessoRota("/produtos");
  const p = await searchParams;
  const filtro = {
    q: texto(p.q),
    materialId: texto(p.materialId),
    categoriaId: texto(p.categoriaId),
    situacao: texto(p.situacao),
    comSaldo: texto(p.comSaldo),
    local: texto(p.local),
  };
  const opcoes = await listarOpcoesDeCadastro(bdAplicacao(), ator);
  let produtos: ProdutoDaLista[] = [];
  let limiteAtingido = false;
  let erro: string | null = null;
  try {
    ({ produtos, limiteAtingido } = await buscarProdutos(bdAplicacao(), ator, filtro));
  } catch (e) {
    if (!(e instanceof ErroValidacao)) throw e;
    erro = e.message;
  }
  const podeGerenciar = temPermissao(ator.perfil, "produtos.gerenciar");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TituloPagina descricao="Busque pelo início do código ou por qualquer trecho da descrição.">Produtos</TituloPagina>
        {podeGerenciar ? (
          <Link href="/produtos/novo" className="inline-flex min-h-10 items-center rounded-md bg-primaria px-4 text-sm font-medium text-primaria-texto hover:bg-primaria-escura">
            Novo produto
          </Link>
        ) : null}
      </div>

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
            <GrupoCampo rotulo="Código ou descrição" htmlFor="f-q">
              <Campo id="f-q" name="q" defaultValue={filtro.q} type="search" autoComplete="off" />
            </GrupoCampo>
          </div>
          <GrupoCampo rotulo="Material" htmlFor="f-material">
            <Selecao id="f-material" name="materialId" defaultValue={filtro.materialId}>
              <option value="">Todos</option>
              {opcoes.materiais.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </Selecao>
          </GrupoCampo>
          <GrupoCampo rotulo="Categoria" htmlFor="f-categoria">
            <Selecao id="f-categoria" name="categoriaId" defaultValue={filtro.categoriaId}>
              <option value="">Todas</option>
              {opcoes.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Selecao>
          </GrupoCampo>
          <GrupoCampo rotulo="Local" htmlFor="f-local">
            <Selecao id="f-local" name="local" defaultValue={filtro.local}>
              <option value="">Todos</option>
              {LOCAIS_ESTOQUE.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Selecao>
          </GrupoCampo>
          <GrupoCampo rotulo="Situação" htmlFor="f-situacao">
            <Selecao id="f-situacao" name="situacao" defaultValue={filtro.situacao || "ativos"}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </Selecao>
          </GrupoCampo>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="comSaldo" value="1" defaultChecked={filtro.comSaldo === "1"} className="size-4" />
            Somente com saldo
          </label>
          <Botao type="submit" variante="secundario">Buscar</Botao>
        </form>
      </Cartao>

      {erro ? <Aviso tipo="erro" className="mb-4">{erro}</Aviso> : null}
      {limiteAtingido ? (
        <Aviso tipo="alerta" className="mb-4">
          Mostrando os {LIMITE_BUSCA_PRODUTOS} primeiros pelo código. Use a busca ou os filtros para refinar.
        </Aviso>
      ) : null}

      {produtos.length === 0 && !erro ? (
        <p className="text-sm text-texto-suave">Nenhum produto encontrado.</p>
      ) : (
        <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
          {produtos.map((prod) => (
            <li key={prod.id}>
              <Link href={`/produtos/${prod.id}`} className="block px-4 py-3 hover:bg-fundo">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 font-medium break-words">
                    <span className="mr-2 font-mono text-sm">{prod.codigo}</span>
                    {prod.descricao}
                  </p>
                  <p className="text-sm font-medium whitespace-nowrap">
                    {prod.precoVenda ? formatarReais(prod.precoVenda) : prod.precoSugerido ? `Sugerido ${formatarReais(prod.precoSugerido)}` : "Sem preço"}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
                  <span>{prod.materialNome} · {prod.categoriaNome}</span>
                  <span>Saldo: {prod.saldo}</span>
                  {prod.localEstoque ? <span>{prod.localEstoque}</span> : null}
                  {prod.ativo ? null : <Etiqueta ativo={false}>Inativo</Etiqueta>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
