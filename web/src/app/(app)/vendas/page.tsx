import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Botao, Campo, Cartao, Etiqueta, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroValidacao } from "@/servidor/erros";
import { temPermissao } from "@/servidor/permissoes";
import { LIMITE_LISTA_VENDAS, listarVendas, type VendaDaLista } from "@/servidor/servicos/vendas";
import { formatarData, formatarReais, hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Vendas" };

type Parametros = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaVendas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const ator = await exigirAcessoRota("/vendas");
  const p = await searchParams;
  const hoje = hojeSaoPaulo();
  // Padrão: o mês corrente.
  const filtro = { de: texto(p.de) || `${hoje.slice(0, 8)}01`, ate: texto(p.ate) || hoje, situacao: texto(p.situacao) };
  let vendas: VendaDaLista[] = [];
  let limiteAtingido = false;
  let erro: string | null = null;
  try {
    ({ vendas, limiteAtingido } = await listarVendas(bdAplicacao(), ator, filtro));
  } catch (e) {
    if (!(e instanceof ErroValidacao)) throw e;
    erro = e.message;
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TituloPagina descricao="Vendas registradas na aplicação. As vendas antigas da planilha aparecem no detalhe de cada produto.">
          Vendas
        </TituloPagina>
        {temPermissao(ator.perfil, "vendas.registrar") ? (
          <Link href="/vendas/nova" className="inline-flex min-h-10 items-center rounded-md bg-primaria px-4 text-sm font-medium text-primaria-texto hover:bg-primaria-escura">
            Nova venda
          </Link>
        ) : null}
      </div>

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <GrupoCampo rotulo="De" htmlFor="de">
            <Campo id="de" name="de" type="date" defaultValue={filtro.de} />
          </GrupoCampo>
          <GrupoCampo rotulo="Até" htmlFor="ate">
            <Campo id="ate" name="ate" type="date" defaultValue={filtro.ate} />
          </GrupoCampo>
          <GrupoCampo rotulo="Situação" htmlFor="situacao">
            <Selecao id="situacao" name="situacao" defaultValue={filtro.situacao}>
              <option value="">Todas</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="CANCELADA">Canceladas</option>
            </Selecao>
          </GrupoCampo>
          <Botao type="submit" variante="secundario">Filtrar</Botao>
        </form>
      </Cartao>

      {erro ? <Aviso tipo="erro" className="mb-4">{erro}</Aviso> : null}
      {limiteAtingido ? (
        <Aviso tipo="alerta" className="mb-4">Mostrando as {LIMITE_LISTA_VENDAS} mais recentes. Reduza o período.</Aviso>
      ) : null}

      {vendas.length === 0 && !erro ? (
        <p className="text-sm text-texto-suave">Nenhuma venda no período.</p>
      ) : (
        <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
          {vendas.map((v) => (
            <li key={v.id}>
              <Link href={`/vendas/${v.id}`} className="block px-4 py-3 hover:bg-fundo">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">Venda nº {v.numero}</p>
                  <p className={v.situacao === "CANCELADA" ? "text-sm text-texto-suave line-through" : "text-sm font-medium"}>
                    {formatarReais(v.valorTotal)}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
                  <span>{formatarData(v.dataVenda)}</span>
                  <span>{v.vendedorNome}</span>
                  <span>{v.quantidadeItens} {v.quantidadeItens === 1 ? "peça" : "peças"}</span>
                  {v.situacao === "CANCELADA" ? <Etiqueta ativo={false}>Cancelada</Etiqueta> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
