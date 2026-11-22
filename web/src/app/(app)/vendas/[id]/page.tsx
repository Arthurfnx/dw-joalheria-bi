import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoCancelarVenda } from "@/app/acoes/vendas";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Campo, Cartao, Etiqueta, GrupoCampo } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroNaoEncontrado, ErroValidacao } from "@/servidor/erros";
import { temPermissao } from "@/servidor/permissoes";
import { obterVenda } from "@/servidor/servicos/vendas";
import { formatarData, formatarDataHora, formatarReais } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Venda" };

export default async function PaginaVenda({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirAcessoRota("/vendas");
  const { id } = await params;
  let dados;
  try {
    dados = await obterVenda(bdAplicacao(), ator, id);
  } catch (e) {
    if (e instanceof ErroNaoEncontrado || e instanceof ErroValidacao) notFound();
    throw e;
  }
  const { venda: v, itens } = dados;
  const podeCancelar = v.situacao === "CONFIRMADA" && temPermissao(ator.perfil, "vendas.cancelar");

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/vendas" className="text-sm text-primaria hover:underline">← Vendas</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Venda nº {v.numero}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Etiqueta ativo={v.situacao === "CONFIRMADA"}>{v.situacao === "CONFIRMADA" ? "Confirmada" : "Cancelada"}</Etiqueta>
        </div>
      </div>

      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-texto-suave">Data da venda</dt><dd>{formatarData(v.dataVenda)}</dd></div>
          <div><dt className="text-xs text-texto-suave">Vendedor</dt><dd className="break-words">{v.vendedorNome}</dd></div>
          <div><dt className="text-xs text-texto-suave">Registrada em</dt><dd>{formatarDataHora(v.registradaEm)}</dd></div>
          {v.observacao ? <div><dt className="text-xs text-texto-suave">Observação</dt><dd className="break-words">{v.observacao}</dd></div> : null}
        </dl>
      </Cartao>

      <Cartao>
        <h2 className="mb-2 font-semibold">Itens</h2>
        <ul className="divide-y divide-borda">
          {itens.map((i) => (
            <li key={i.id} className="py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-x-3">
                <Link href={`/produtos/${i.produtoId}`} className="min-w-0 break-words hover:underline">
                  <span className="mr-2 font-mono">{i.codigo}</span>
                  {i.descricao}
                </Link>
                <span className="font-medium">{formatarReais(i.valorItem)}</span>
              </div>
              <p className="text-xs text-texto-suave">
                {i.quantidade} × {formatarReais(i.precoPraticado)}
                {i.precoTabela && i.precoTabela !== i.precoPraticado ? ` · tabela ${formatarReais(i.precoTabela)}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-borda pt-3 text-right text-lg font-semibold">Total: {formatarReais(v.valorTotal)}</p>
      </Cartao>

      {v.situacao === "CANCELADA" ? (
        <Cartao>
          <p className="font-medium">Cancelada em {v.canceladaEm ? formatarDataHora(v.canceladaEm) : "—"} por {v.canceladaPor ?? "—"}</p>
          <p className="text-sm break-words text-texto-suave">Motivo: {v.motivoCancelamento}</p>
        </Cartao>
      ) : null}

      {podeCancelar ? (
        <Cartao>
          <h2 className="mb-2 font-semibold">Cancelar venda</h2>
          <p className="mb-3 text-sm text-texto-suave">Cancela a venda inteira e devolve as peças ao estoque. Não pode ser desfeito.</p>
          <FormularioAcao acao={acaoCancelarVenda} rotuloBotao="Cancelar venda" varianteBotao="perigo" confirmar={`Cancelar a venda nº ${v.numero}?`}>
            <input type="hidden" name="id" value={v.id} />
            <GrupoCampo rotulo="Motivo" htmlFor="motivo">
              <Campo id="motivo" name="motivo" required maxLength={500} />
            </GrupoCampo>
          </FormularioAcao>
        </Cartao>
      ) : null}
    </div>
  );
}
