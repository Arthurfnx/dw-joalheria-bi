// Seção "Gráficos e filtros" da tela Relatórios: os indicadores do painel do
// Grafana, lidos do Data Warehouse. Componente de servidor; só os gráficos
// (que medem a largura da tela) rodam no navegador.

import type { ReactNode } from "react";
import { Botao, Cartao, cn, GrupoCampo, Selecao } from "@/componentes/ui";
import { GraficoBarras, GraficoTempo } from "@/componentes/graficos";
import type { RelatoriosDw, VendasAgrupadas } from "@/servidor/servicos/relatorios-dw";
import { LIMITE_PARADOS } from "@/servidor/servicos/relatorios-dw";
import { descreverFiltros, type FiltrosRelatorio, type OpcoesFiltro } from "@/web/filtros-relatorios";
import { formatarData, formatarDecimal, formatarReais } from "@/web/formatacao";
import { descreverSerie, formatarPecas, rotuloMes, rotuloMesLongo, type SerieGrafico } from "@/web/indicadores";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const INTEIRO = new Intl.NumberFormat("pt-BR");

const dias = (v: string | null) => (v === null ? "—" : `${formatarDecimal(v)} dias`);
const pct = (v: string | null) => (v === null ? "—" : `${formatarDecimal(v)}%`);

function serieReceita(itens: { rotulo: string; rotuloLongo: string; receita: string }[]): SerieGrafico {
  return {
    unidade: "VALOR",
    pontos: itens.map((i) => ({ ...i, valor: Number(i.receita), texto: formatarReais(i.receita) })),
  };
}

function seriePecas(itens: { rotulo: string; rotuloLongo: string; pecas: number }[]): SerieGrafico {
  return {
    unidade: "PECAS",
    pontos: itens.map((i) => ({ ...i, valor: i.pecas, texto: formatarPecas(i.pecas) })),
  };
}

const porNome = (l: VendasAgrupadas[]) => l.map((x) => ({ ...x, rotulo: x.nome, rotuloLongo: x.nome }));

function somaReais(valores: string[]): string {
  // Soma em centavos inteiros, para não passar por ponto flutuante.
  const centavos = valores.reduce((s, v) => s + BigInt(v.replace(".", "")), BigInt(0));
  const texto = centavos.toString().padStart(3, "0");
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

function Secao({
  numero,
  titulo,
  formula,
  children,
}: {
  numero: number;
  titulo: string;
  formula: ReactNode;
  children: ReactNode;
}) {
  return (
    <Cartao className="min-w-0">
      <h3 className="text-base font-semibold">
        {numero}. {titulo}
      </h3>
      <p className="mt-1 text-xs text-texto-suave">{formula}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </Cartao>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-sm font-medium">{children}</h4>;
}

function SemDados() {
  return <p className="text-sm text-texto-suave">Sem dados para os filtros escolhidos.</p>;
}

/** Tabela que rola dentro do próprio contêiner, sem alargar a página a 360 px. */
function Tabela({
  legenda,
  cabecalho,
  colunasTexto = 1,
  children,
}: {
  legenda: string;
  cabecalho: string[];
  /** Quantas colunas iniciais são texto (alinhadas à esquerda); as demais são números. */
  colunasTexto?: number;
  children: ReactNode;
}) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-borda">
      <table className="w-full min-w-max text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5">
        <caption className="sr-only">{legenda}</caption>
        <thead className="sticky top-0 bg-fundo text-left text-xs text-texto-suave">
          <tr>
            {cabecalho.map((c, i) => (
              <th key={c} scope="col" className={cn("font-medium", i >= colunasTexto && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}

function Totais({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {itens.map((i) => (
        <div key={i.rotulo} className="rounded-md border border-borda bg-fundo px-3 py-2">
          <dt className="text-xs text-texto-suave">{i.rotulo}</dt>
          <dd className="text-lg font-semibold">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FormularioFiltros({ opcoes, filtros }: { opcoes: OpcoesFiltro; filtros: FiltrosRelatorio }) {
  return (
    <form method="get" action="/relatorios" className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <GrupoCampo rotulo="Material" htmlFor="filtro-material">
        <Selecao id="filtro-material" name="material" defaultValue={filtros.material ?? ""}>
          <option value="">Todos</option>
          {opcoes.materiais.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Selecao>
      </GrupoCampo>
      <GrupoCampo rotulo="Tipo de peça" htmlFor="filtro-tipo">
        <Selecao id="filtro-tipo" name="tipo" defaultValue={filtros.tipo ?? ""}>
          <option value="">Todos</option>
          {opcoes.tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Selecao>
      </GrupoCampo>
      <GrupoCampo rotulo="Ano da venda" htmlFor="filtro-ano">
        <Selecao id="filtro-ano" name="ano" defaultValue={filtros.ano ?? ""}>
          <option value="">Todos</option>
          {opcoes.anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selecao>
      </GrupoCampo>
      <div className="flex items-center gap-3">
        <Botao type="submit">Aplicar</Botao>
        <a href="/relatorios" className="text-sm text-primaria underline-offset-2 hover:underline">
          Limpar
        </a>
      </div>
    </form>
  );
}

export function GraficosDw({ dados, filtros }: { dados: RelatoriosDw; filtros: FiltrosRelatorio }) {
  const { totais } = dados;
  const filtrosTexto = descreverFiltros(filtros);
  const semAno = filtros.ano ? " O filtro de Ano não se aplica a esta seção." : " O Ano não se aplica a esta seção.";

  const meses = dados.meses.map((m) => ({ ...m, rotulo: rotuloMes(m.mes), rotuloLongo: rotuloMesLongo(m.mes) }));
  const serieReceitaMes = serieReceita(meses);
  const seriePecasMes = seriePecas(meses);
  const saz = dados.sazonalidade.map((m) => ({ ...m, rotulo: MESES[m.mes - 1], rotuloLongo: MESES_LONGOS[m.mes - 1] }));
  const serieSazPecas = seriePecas(saz);
  const serieSazReceita = serieReceita(saz);
  const tiposPecas = seriePecas(porNome(dados.porTipo));
  const tiposReceita = serieReceita(porNome(dados.porTipo));
  const materiaisPecas = seriePecas(porNome(dados.porMaterial));
  const materiaisReceita = serieReceita(porNome(dados.porMaterial));
  const medianas: SerieGrafico = {
    unidade: "PECAS",
    pontos: dados.tipoParado.map((t) => ({
      rotulo: t.tipo,
      rotuloLongo: t.tipo,
      valor: Number(t.mediana),
      texto: dias(t.mediana),
    })),
  };
  const totalReceita = formatarReais(totais.receita);
  const totalPecas = formatarPecas(totais.pecas);
  const periodo =
    totais.primeiroMes && totais.ultimoMes
      ? `${rotuloMes(totais.primeiroMes)} a ${rotuloMes(totais.ultimoMes)}`
      : "—";
  const totalSemData = dados.parados.semData.reduce((s, x) => s + x.pecas, 0);

  return (
    <div className="space-y-4">
      <Secao
        numero={1}
        titulo="Vendas por período"
        formula="Receita (R$) = soma do valor faturado, sem vendas simbólicas de R$ 0,01 nem vendas sem valor. Peças vendidas = soma das quantidades, incluindo essas vendas. Peças e reais ficam em gráficos separados."
      >
        <Totais
          itens={[
            { rotulo: "Receita faturada", valor: totalReceita },
            { rotulo: "Peças vendidas", valor: totalPecas },
            { rotulo: "Peças vendidas sem receita", valor: formatarPecas(totais.pecasSemReceita) },
            { rotulo: "Período das vendas", valor: periodo },
          ]}
        />
        {meses.length === 0 ? (
          <SemDados />
        ) : (
          <>
            <div>
              <Subtitulo>Receita por mês (R$)</Subtitulo>
              <GraficoTempo
                tipo="colunas"
                serie={serieReceitaMes}
                titulo={`Receita faturada por mês, ${filtrosTexto}`}
                descricao={descreverSerie(serieReceitaMes, "tempo", totalReceita)}
              />
            </div>
            <div>
              <Subtitulo>Peças vendidas por mês</Subtitulo>
              <GraficoTempo
                tipo="colunas"
                serie={seriePecasMes}
                titulo={`Peças vendidas por mês, ${filtrosTexto}`}
                descricao={descreverSerie(seriePecasMes, "tempo", totalPecas)}
              />
            </div>
          </>
        )}
      </Secao>

      <Secao
        numero={2}
        titulo="Tipos vendidos"
        formula="Peças = soma das quantidades vendidas; receita (R$) = soma do valor faturado. Por tipo de peça e por material."
      >
        {dados.porTipo.length === 0 ? (
          <SemDados />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0">
              <Subtitulo>Peças vendidas por tipo de peça</Subtitulo>
              <GraficoBarras
                serie={tiposPecas}
                titulo="Peças vendidas por tipo de peça"
                descricao={descreverSerie(tiposPecas, "itens", totalPecas)}
              />
            </div>
            <div className="min-w-0">
              <Subtitulo>Receita por tipo de peça (R$)</Subtitulo>
              <GraficoBarras
                serie={tiposReceita}
                titulo="Receita faturada por tipo de peça"
                descricao={descreverSerie(tiposReceita, "itens", totalReceita)}
              />
            </div>
            <div className="min-w-0">
              <Subtitulo>Peças vendidas por material</Subtitulo>
              <GraficoBarras
                serie={materiaisPecas}
                titulo="Peças vendidas por material"
                descricao={descreverSerie(materiaisPecas, "itens", totalPecas)}
              />
            </div>
            <div className="min-w-0">
              <Subtitulo>Receita por material (R$)</Subtitulo>
              <GraficoBarras
                serie={materiaisReceita}
                titulo="Receita faturada por material"
                descricao={descreverSerie(materiaisReceita, "itens", totalReceita)}
              />
            </div>
          </div>
        )}
      </Secao>

      <Secao
        numero={3}
        titulo="Taxa de venda e tempo até a venda"
        formula="Taxa de venda (%) = peças vendidas ÷ (peças vendidas + peças em estoque hoje). Tempo até a venda (dias) = data da venda − data de aquisição, só nas vendas cujo produto tem data de aquisição (amostra). O Ano filtra só as vendas. Não é o giro de estoque tradicional."
      >
        <Totais
          itens={[
            { rotulo: "Peças em estoque hoje", valor: formatarPecas(totais.pecasEmEstoque) },
            { rotulo: "Peças vendidas", valor: totalPecas },
          ]}
        />
        {dados.taxa.length === 0 ? (
          <SemDados />
        ) : (
          <Tabela
            legenda="Taxa de venda e tempo até a venda por tipo de peça"
            cabecalho={["Tipo de peça", "Vendidas", "Em estoque hoje", "Taxa de venda", "Amostra", "Média até a venda", "Mediana até a venda"]}
          >
            {dados.taxa.map((t) => (
              <tr key={t.tipo}>
                <td>{t.tipo}</td>
                <td className="text-right">{INTEIRO.format(t.vendidas)}</td>
                <td className="text-right">{INTEIRO.format(t.emEstoque)}</td>
                <td className="text-right">{pct(t.taxa)}</td>
                <td className="text-right">{INTEIRO.format(t.amostra)}</td>
                <td className="text-right">{dias(t.mediaDias)}</td>
                <td className="text-right">{dias(t.medianaDias)}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        numero={4}
        titulo="Produtos parados"
        formula={`Dias parado = data de referência da carga − data de aquisição, para peças em estoque hoje; os mais antigos primeiro. Unidade: dias.${semAno}`}
      >
        {dados.parados.linhas.length === 0 ? (
          <SemDados />
        ) : (
          <div>
            <p className="mb-2 text-sm text-texto-suave">
              {dados.parados.total > dados.parados.linhas.length
                ? `Mostrando os ${dados.parados.linhas.length} mais antigos de ${INTEIRO.format(dados.parados.total)} produtos com data de aquisição.`
                : `${INTEIRO.format(dados.parados.total)} produtos com data de aquisição.`}
            </p>
            <Tabela
              legenda={`Produtos parados, os ${LIMITE_PARADOS} mais antigos primeiro`}
              cabecalho={["Material", "Tipo de peça", "Código", "Descrição", "Dias parado"]}
              colunasTexto={4}
            >
              {dados.parados.linhas.map((l, i) => (
                <tr key={`${l.codigo}-${i}`}>
                  <td>{l.material}</td>
                  <td>{l.tipo}</td>
                  <td>{l.codigo}</td>
                  <td className="max-w-[16rem] truncate" title={l.descricao}>
                    {l.descricao}
                  </td>
                  <td className="text-right">{INTEIRO.format(l.dias)}</td>
                </tr>
              ))}
            </Tabela>
          </div>
        )}
        {dados.parados.semData.length > 0 ? (
          <div>
            <Subtitulo>Peças em estoque sem data de aquisição, por tipo ({formatarPecas(totalSemData)})</Subtitulo>
            <p className="mb-2 text-xs text-texto-suave">Ficam fora do cálculo de dias parado: nenhuma data é estimada.</p>
            <Tabela legenda="Peças em estoque sem data de aquisição, por tipo de peça" cabecalho={["Tipo de peça", "Peças"]}>
              {dados.parados.semData.map((s) => (
                <tr key={s.tipo}>
                  <td>{s.tipo}</td>
                  <td className="text-right">{INTEIRO.format(s.pecas)}</td>
                </tr>
              ))}
            </Tabela>
          </div>
        ) : null}
      </Secao>

      <Secao
        numero={5}
        titulo="Tipo que mais fica parado"
        formula={`Mediana e média dos dias parado por tipo de peça, só peças em estoque hoje com data de aquisição; % acima de 180 dias = peças paradas há mais de 180 dias ÷ peças com data. Unidade: dias.${semAno}`}
      >
        {dados.tipoParado.length === 0 ? (
          <SemDados />
        ) : (
          <>
            <div>
              <Subtitulo>Mediana de dias parado por tipo de peça</Subtitulo>
              <GraficoBarras
                serie={medianas}
                titulo="Mediana de dias parado por tipo de peça"
                descricao={descreverSerie(medianas, "itens", `${dados.tipoParado.length} tipos`)}
              />
            </div>
            <Tabela
              legenda="Dias parado por tipo de peça"
              cabecalho={["Tipo de peça", "Peças com data", "Mediana", "Média", "% acima de 180 dias", "Sem data"]}
            >
              {dados.tipoParado.map((t) => (
                <tr key={t.tipo}>
                  <td>{t.tipo}</td>
                  <td className="text-right">{INTEIRO.format(t.comData)}</td>
                  <td className="text-right">{dias(t.mediana)}</td>
                  <td className="text-right">{dias(t.media)}</td>
                  <td className="text-right">{pct(t.acima180)}</td>
                  <td className="text-right">{INTEIRO.format(t.semData)}</td>
                </tr>
              ))}
            </Tabela>
          </>
        )}
      </Secao>

      <Secao
        numero={6}
        titulo="Sazonalidade"
        formula="Peças vendidas e receita (R$) por mês do ano, somando os anos dentro do filtro. Com poucas vendas, o padrão é indicativo; meses cobertos por mais de um ano pesam mais."
      >
        {totais.pecas === 0 ? (
          <SemDados />
        ) : (
          <>
            <div>
              <Subtitulo>Peças vendidas por mês do ano</Subtitulo>
              <GraficoTempo
                tipo="colunas"
                serie={serieSazPecas}
                titulo={`Peças vendidas por mês do ano, ${filtrosTexto}`}
                descricao={descreverSerie(serieSazPecas, "itens", totalPecas)}
              />
            </div>
            <div>
              <Subtitulo>Receita por mês do ano (R$)</Subtitulo>
              <GraficoTempo
                tipo="colunas"
                serie={serieSazReceita}
                titulo={`Receita faturada por mês do ano, ${filtrosTexto}`}
                descricao={descreverSerie(serieSazReceita, "itens", formatarReais(somaReais(saz.map((s) => s.receita))))}
              />
            </div>
          </>
        )}
      </Secao>

      <Secao
        numero={7}
        titulo="Reposição — proposta (a confirmar com o proprietário)"
        formula={`Cobertura (meses) = estoque atual ÷ (peças vendidas nos 12 meses anteriores à data de referência ÷ 12). Abaixo de 3 meses: repor. Sem vendas em 12 meses, a cobertura fica indefinida. A regra usa sempre os últimos 12 meses.${semAno}`}
      >
        {dados.reposicao.length === 0 ? (
          <SemDados />
        ) : (
          <Tabela
            legenda="Reposição por material e tipo de peça, menor cobertura primeiro"
            cabecalho={["Material", "Tipo de peça", "Estoque atual", "Vendidas em 12 meses", "Cobertura (meses)", "Situação (proposta)"]}
            colunasTexto={2}
          >
            {dados.reposicao.map((r) => (
              <tr key={`${r.material}|${r.tipo}`} className={r.repor ? "bg-aviso-fundo" : undefined}>
                <td>{r.material}</td>
                <td>{r.tipo}</td>
                <td className="text-right">{INTEIRO.format(r.estoque)}</td>
                <td className="text-right">{INTEIRO.format(r.vendidas12m)}</td>
                <td className="text-right">{r.cobertura === null ? "—" : formatarDecimal(r.cobertura)}</td>
                <td className={cn("text-right", r.repor && "font-semibold text-aviso")}>
                  {r.cobertura === null
                    ? "Sem vendas em 12 meses"
                    : r.repor
                      ? "Repor (abaixo de 3 meses)"
                      : "3 meses ou mais"}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </div>
  );
}

export function CabecalhoGraficos({ dataReferencia, carregadoEm }: { dataReferencia: string | null; carregadoEm: string | null }) {
  return (
    <p className="mt-1 text-sm text-texto-suave">
      Dados do Data Warehouse, atualizados a cada carga do ETL.
      {dataReferencia ? ` Última carga: dados de ${formatarData(dataReferencia)}` : ""}
      {carregadoEm ? `, carregados em ${carregadoEm} (horário de Brasília).` : dataReferencia ? "." : ""}
    </p>
  );
}
