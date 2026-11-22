import type { Metadata } from "next";
import Link from "next/link";
import { acaoMovimentarEstoque } from "@/app/acoes/produtos";
import { FormularioAcao } from "@/componentes/formulario-acao";
import { Aviso, Botao, Campo, Cartao, GrupoCampo, Selecao, TituloPagina } from "@/componentes/ui";
import { bdAplicacao } from "@/servidor/bd/conexao";
import { ErroNaoEncontrado, ErroValidacao } from "@/servidor/erros";
import { TIPOS_MOVIMENTACAO_MANUAL } from "@/servidor/servicos/estoque";
import { buscarProdutos, obterProduto } from "@/servidor/servicos/produtos";
import { hojeSaoPaulo } from "@/web/formatacao";
import { exigirAcessoRota } from "@/web/sessao";

export const metadata: Metadata = { title: "Saída ou ajuste" };

type Parametros = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function PaginaMovimentar({ searchParams }: { searchParams: Promise<Parametros> }) {
  const ator = await exigirAcessoRota("/estoque/movimentar");
  const p = await searchParams;
  const produtoId = texto(p.produtoId);
  const q = texto(p.q);

  let produto: Awaited<ReturnType<typeof obterProduto>>["produto"] | null = null;
  if (produtoId) {
    try {
      produto = (await obterProduto(bdAplicacao(), ator, produtoId)).produto;
    } catch (e) {
      if (!(e instanceof ErroNaoEncontrado || e instanceof ErroValidacao)) throw e;
    }
  }
  const resultados = !produto && q ? (await buscarProdutos(bdAplicacao(), ator, { q })).produtos.slice(0, 20) : [];

  return (
    <>
      <TituloPagina descricao="Saídas não comerciais (presente, perda, roubo) e ajustes. Não geram venda nem faturamento.">
        Saída ou ajuste
      </TituloPagina>

      {!produto ? (
        <Cartao className="max-w-2xl">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <GrupoCampo rotulo="Produto (código ou descrição)" htmlFor="q">
                <Campo id="q" name="q" type="search" defaultValue={q} autoComplete="off" />
              </GrupoCampo>
            </div>
            <Botao type="submit" variante="secundario">Buscar</Botao>
          </form>
          {q && resultados.length === 0 ? <p className="mt-3 text-sm text-texto-suave">Nenhum produto encontrado.</p> : null}
          {resultados.length > 0 ? (
            <ul className="mt-3 divide-y divide-borda">
              {resultados.map((r) => (
                <li key={r.id}>
                  <Link href={`/estoque/movimentar?produtoId=${r.id}`} className="block py-2 text-sm hover:bg-fundo">
                    <span className="mr-2 font-mono">{r.codigo}</span>
                    <span className="break-words">{r.descricao}</span>
                    <span className="ml-2 text-xs text-texto-suave">saldo {r.saldo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Cartao>
      ) : (
        <Cartao className="max-w-2xl">
          <p className="font-medium break-words">
            <span className="mr-2 font-mono">{produto.codigo}</span>
            {produto.descricao}
          </p>
          <p className="mb-4 text-sm text-texto-suave">
            Saldo atual: {produto.saldo} · <Link href="/estoque/movimentar" className="text-primaria hover:underline">trocar produto</Link>
          </p>
          {!produto.ativo ? <Aviso tipo="alerta" className="mb-3">Produto inativo: não pode ser movimentado.</Aviso> : null}
          <FormularioAcao acao={acaoMovimentarEstoque} rotuloBotao="Registrar">
            <input type="hidden" name="produtoId" value={produto.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <GrupoCampo rotulo="Tipo" htmlFor="tipo">
                <Selecao id="tipo" name="tipo" defaultValue="" required>
                  <option value="" disabled>Escolha</option>
                  {TIPOS_MOVIMENTACAO_MANUAL.map((t) => (
                    <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>
                  ))}
                </Selecao>
              </GrupoCampo>
              <GrupoCampo rotulo="Quantidade" htmlFor="quantidade">
                <Campo id="quantidade" name="quantidade" inputMode="numeric" defaultValue="1" required />
              </GrupoCampo>
              <GrupoCampo rotulo="Data da ocorrência" htmlFor="dataOcorrencia">
                <Campo id="dataOcorrencia" name="dataOcorrencia" type="date" max={hojeSaoPaulo()} defaultValue={hojeSaoPaulo()} required />
              </GrupoCampo>
              <div className="sm:col-span-2">
                <GrupoCampo rotulo="Motivo" htmlFor="motivo">
                  <Campo id="motivo" name="motivo" required maxLength={500} />
                </GrupoCampo>
              </div>
            </div>
          </FormularioAcao>
          <Link href={`/produtos/${produto.id}`} className="mt-4 inline-block text-sm text-primaria hover:underline">
            Ver histórico do produto
          </Link>
        </Cartao>
      )}
    </>
  );
}
