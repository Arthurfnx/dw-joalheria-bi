"use client";

// Cartões dos indicadores com o seletor de formato (RN-111, RN-112). A
// escolha vale só para a tela aberta: recarregar volta ao recomendado.

import { useId, useState, type ReactNode } from "react";
import { Cartao, cn } from "@/componentes/ui";
import { GraficoBarras, GraficoRosca, GraficoTempo } from "@/componentes/graficos";
import type { Formato, Recomendacao } from "@/servidor/recomendacao-formato";
import type { EstoqueAgrupado, VendasPorMes } from "@/servidor/servicos/indicadores";
import { formatarReais } from "@/web/formatacao";
import {
  descreverSerie,
  formatarPecas,
  formatarPercentual,
  rotuloMes,
  rotuloMesLongo,
  serieEstoque,
  serieVendas,
  type Medida,
} from "@/web/indicadores";

const NOMES_FORMATO: Record<Formato, string> = {
  LINHA: "Linha",
  BARRAS: "Barras",
  ROSCA: "Rosca",
  CARTOES: "Cartões",
  TABELA: "Tabela",
};

function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoEscolher,
  destaque,
}: {
  rotulo: string;
  opcoes: { valor: T; nome: string }[];
  valor: T;
  aoEscolher: (v: T) => void;
  destaque?: T;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1 rounded-md border border-borda bg-fundo p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => aoEscolher(o.valor)}
          className={cn(
            "min-h-9 rounded px-3 py-1.5 text-sm transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primaria",
            valor === o.valor ? "bg-superficie font-medium text-texto shadow-sm" : "text-texto-suave hover:text-texto",
          )}
        >
          {o.nome}
          {destaque === o.valor ? (
            <span className="ml-1.5 rounded-full bg-sucesso-fundo px-1.5 py-0.5 text-[11px] font-medium text-sucesso">
              Recomendado
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CartaoIndicador({
  titulo,
  subtitulo,
  formatos,
  recomendacao,
  controles,
  children,
}: {
  titulo: string;
  subtitulo: string;
  formatos: Formato[];
  recomendacao: Recomendacao;
  controles?: ReactNode;
  children: (formato: Formato) => ReactNode;
}) {
  const [formato, setFormato] = useState<Formato>(recomendacao.formato);
  const idTitulo = useId();
  return (
    <Cartao className="min-w-0" role="region" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="text-lg font-semibold">
        {titulo}
      </h2>
      <p className="text-sm text-texto-suave">{subtitulo}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmentado
          rotulo={`Formato de ${titulo}`}
          opcoes={formatos.map((f) => ({ valor: f, nome: NOMES_FORMATO[f] }))}
          valor={formato}
          aoEscolher={setFormato}
          destaque={recomendacao.formato}
        />
        {controles}
      </div>
      <p className="mt-2 text-xs text-texto-suave">
        <span className="font-medium">Por que {NOMES_FORMATO[recomendacao.formato].toLowerCase()}?</span> {recomendacao.motivo}
      </p>
      <div className="mt-4 min-w-0">{children(formato)}</div>
    </Cartao>
  );
}

const CLASSES_TABELA = "w-full text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5";

function Tabela({ legenda, children }: { legenda: string; children: ReactNode }) {
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      <table className={CLASSES_TABELA}>
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

function VendasMes({ dados, recomendacao }: { dados: VendasPorMes; recomendacao: Recomendacao }) {
  // RN-114: uma medida por vez; o gráfico nunca mistura peças e reais.
  const [medida, setMedida] = useState<Medida>("PECAS");
  const serie = serieVendas(dados.meses, medida);
  const totalTexto = medida === "PECAS" ? formatarPecas(dados.total.pecasTotal) : formatarReais(dados.total.valorTotal);
  const nomeMedida = medida === "PECAS" ? "peças vendidas" : "valor vendido";
  const titulo = `Vendas por mês, em ${nomeMedida}, aplicação e planilha somadas`;
  const pecas = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
  return (
    <CartaoIndicador
      titulo="Vendas por mês"
      subtitulo="Últimos 24 meses. Vendas da aplicação (canceladas fora) e histórico das planilhas."
      formatos={["LINHA", "BARRAS", "TABELA"]}
      recomendacao={recomendacao}
      controles={
        <Segmentado
          rotulo="Medida"
          opcoes={[
            { valor: "PECAS", nome: "Quantidade" },
            { valor: "VALOR", nome: "Valor" },
          ]}
          valor={medida}
          aoEscolher={setMedida}
        />
      }
    >
      {(formato) =>
        formato === "TABELA" ? (
          <Tabela legenda={`Vendas por mês, em ${nomeMedida}, por origem`}>
            <thead className="sticky top-0 bg-superficie text-left text-texto-suave">
              <tr className="border-b border-borda">
                <th scope="col">Mês</th>
                <th scope="col" className="text-right">Aplicação</th>
                <th scope="col" className="text-right">Planilha</th>
                <th scope="col" className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {dados.meses.map((m) => (
                <tr key={m.mes} className="border-b border-borda/60">
                  <th scope="row" className="text-left font-normal">
                    <span className="hidden sm:inline">{rotuloMesLongo(m.mes)}</span>
                    <span className="sm:hidden">{rotuloMes(m.mes)}</span>
                  </th>
                  {medida === "PECAS" ? (
                    <>
                      <td className="text-right tabular-nums">{pecas(m.pecasAplicacao)}</td>
                      <td className="text-right tabular-nums">{pecas(m.pecasPlanilha)}</td>
                      <td className="text-right font-medium tabular-nums">{pecas(m.pecasTotal)}</td>
                    </>
                  ) : (
                    <>
                      <td className="text-right tabular-nums">{formatarReais(m.valorAplicacao)}</td>
                      <td className="text-right tabular-nums">{formatarReais(m.valorPlanilha)}</td>
                      <td className="text-right font-medium tabular-nums">{formatarReais(m.valorTotal)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-superficie font-semibold">
              <tr className="border-t border-borda">
                <th scope="row" className="text-left">Total</th>
                {medida === "PECAS" ? (
                  <>
                    <td className="text-right tabular-nums">{pecas(dados.total.pecasAplicacao)}</td>
                    <td className="text-right tabular-nums">{pecas(dados.total.pecasPlanilha)}</td>
                    <td className="text-right tabular-nums">{pecas(dados.total.pecasTotal)}</td>
                  </>
                ) : (
                  <>
                    <td className="text-right tabular-nums">{formatarReais(dados.total.valorAplicacao)}</td>
                    <td className="text-right tabular-nums">{formatarReais(dados.total.valorPlanilha)}</td>
                    <td className="text-right tabular-nums">{formatarReais(dados.total.valorTotal)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          </Tabela>
        ) : (
          <>
            <GraficoTempo
              serie={serie}
              tipo={formato === "LINHA" ? "linha" : "colunas"}
              titulo={titulo}
              descricao={descreverSerie(serie, "tempo", totalTexto)}
            />
            <p className="mt-2 text-xs text-texto-suave">
              Legenda: {medida === "PECAS" ? "peças vendidas" : "valor vendido, em reais"} por mês (aplicação + planilha). Total do
              período: {totalTexto}.
              {medida === "VALOR" ? " Vendas simbólicas e sem valor ficam fora do valor." : ""}
            </p>
          </>
        )
      }
    </CartaoIndicador>
  );
}

function Estoque({
  titulo,
  nomeItem,
  dados,
  formatos,
  recomendacao,
}: {
  titulo: string;
  nomeItem: string;
  dados: EstoqueAgrupado;
  formatos: Formato[];
  recomendacao: Recomendacao;
}) {
  const serie = serieEstoque(dados.itens);
  const totalTexto = formatarPecas(dados.totalPecas);
  const tituloGrafico = `${titulo}, em peças`;
  return (
    <CartaoIndicador
      titulo={titulo}
      subtitulo={`Soma dos saldos dos produtos ativos, em peças. Total: ${totalTexto}.`}
      formatos={formatos}
      recomendacao={recomendacao}
    >
      {(formato) => {
        if (dados.itens.length === 0) return <p className="text-sm text-texto-suave">Nenhuma peça em estoque.</p>;
        switch (formato) {
          case "BARRAS":
            return <GraficoBarras serie={serie} titulo={tituloGrafico} descricao={descreverSerie(serie, "itens", totalTexto)} />;
          case "ROSCA":
            return (
              <GraficoRosca
                serie={serie}
                rotuloTotal="peças"
                titulo={tituloGrafico}
                descricao={descreverSerie(serie, "itens", totalTexto)}
              />
            );
          case "CARTOES":
            return (
              <ul className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3">
                {dados.itens.map((i) => (
                  <li key={i.nome} className="rounded-md border border-borda p-3">
                    <p className="truncate text-sm text-texto-suave">{i.nome}</p>
                    <p className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat("pt-BR").format(i.pecas)}</p>
                    <p className="text-xs text-texto-suave">
                      {i.pecas === 1 ? "peça" : "peças"} · {formatarPercentual(i.pecas, dados.totalPecas)} do estoque
                    </p>
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <Tabela legenda={`${titulo}, em peças`}>
                <thead className="sticky top-0 bg-superficie text-left text-texto-suave">
                  <tr className="border-b border-borda">
                    <th scope="col">{nomeItem}</th>
                    <th scope="col" className="text-right">Peças</th>
                    <th scope="col" className="text-right">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.itens.map((i) => (
                    <tr key={i.nome} className="border-b border-borda/60">
                      <th scope="row" className="text-left font-normal">{i.nome}</th>
                      <td className="text-right tabular-nums">{new Intl.NumberFormat("pt-BR").format(i.pecas)}</td>
                      <td className="text-right tabular-nums">{formatarPercentual(i.pecas, dados.totalPecas)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-superficie font-semibold">
                  <tr className="border-t border-borda">
                    <th scope="row" className="text-left">Total</th>
                    <td className="text-right tabular-nums">{new Intl.NumberFormat("pt-BR").format(dados.totalPecas)}</td>
                    <td className="text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </Tabela>
            );
        }
      }}
    </CartaoIndicador>
  );
}

export function PainelIndicadores({
  vendas,
  categorias,
  materiais,
  recomendacoes,
}: {
  vendas: VendasPorMes;
  categorias: EstoqueAgrupado;
  materiais: EstoqueAgrupado;
  recomendacoes: { vendas: Recomendacao; categorias: Recomendacao; materiais: Recomendacao };
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <div className="min-w-0 xl:col-span-2">
        <VendasMes dados={vendas} recomendacao={recomendacoes.vendas} />
      </div>
      <Estoque
        titulo="Estoque por categoria"
        nomeItem="Categoria"
        dados={categorias}
        formatos={["BARRAS", "ROSCA", "TABELA"]}
        recomendacao={recomendacoes.categorias}
      />
      <Estoque
        titulo="Estoque por material"
        nomeItem="Material"
        dados={materiais}
        formatos={["ROSCA", "BARRAS", "TABELA", "CARTOES"]}
        recomendacao={recomendacoes.materiais}
      />
    </div>
  );
}
