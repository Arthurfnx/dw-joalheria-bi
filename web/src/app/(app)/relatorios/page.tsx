import type { Metadata } from "next";
import { Aviso, Cartao, TituloPagina } from "@/componentes/ui";
import { urlPainel } from "@/servidor/ambiente";
import { poolDw } from "@/servidor/bd/conexao-dw";
import { carregarRelatorios, opcoesFiltro, type RelatoriosDw } from "@/servidor/servicos/relatorios-dw";
import { lerFiltros, type FiltrosRelatorio, type OpcoesFiltro, type ParametrosUrl } from "@/web/filtros-relatorios";
import { exigirAcessoRota } from "@/web/sessao";
import { CabecalhoGraficos, FormularioFiltros, GraficosDw } from "./graficos-dw";

export const metadata: Metadata = { title: "Relatórios" };

const CONTEUDO_DO_PAINEL = [
  "Vendas por período",
  "Tipos de produto vendidos",
  "Taxa de venda e tempo até a venda",
  "Produtos parados",
  "Tipo que mais fica parado",
  "Sazonalidade e reposição",
];

type CargaDw =
  | { situacao: "sem-configuracao" }
  | { situacao: "falha" }
  | { situacao: "ok"; opcoes: OpcoesFiltro; filtros: FiltrosRelatorio; dados: RelatoriosDw };

async function carregarDw(parametros: ParametrosUrl): Promise<CargaDw> {
  const pool = poolDw();
  if (!pool) return { situacao: "sem-configuracao" };
  try {
    // Os filtros só valem se constarem das listas do próprio DW; o resto vira "Todos".
    const opcoes = await opcoesFiltro(pool);
    const filtros = lerFiltros(parametros, opcoes);
    return { situacao: "ok", opcoes, filtros, dados: await carregarRelatorios(pool, filtros) };
  } catch (erro) {
    // Falha do DW não derruba a tela: o cartão do painel continua disponível.
    console.error("Falha ao consultar o Data Warehouse:", erro instanceof Error ? erro.message : erro);
    return { situacao: "falha" };
  }
}

export default async function PaginaRelatorios({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  // RN-72: a permissão é conferida antes de o endereço ser lido e enviado ao navegador.
  await exigirAcessoRota("/relatorios");
  const url = urlPainel();
  const dw = await carregarDw(await searchParams);

  return (
    <>
      <TituloPagina>Relatórios</TituloPagina>
      {url ? (
        // O Grafana Cloud proíbe ser exibido em quadro (frame-ancestors 'none'); por isso o painel abre em nova aba.
        <Cartao>
          <h2 className="text-lg font-semibold">Painel de indicadores</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Painel de indicadores (Grafana), atualizado a partir do Data Warehouse. Abre em uma nova aba, sem
            necessidade de login.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {CONTEUDO_DO_PAINEL.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primaria px-4 py-2 text-sm font-medium text-primaria-texto transition-colors hover:bg-primaria-escura focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            Abrir o painel
          </a>
        </Cartao>
      ) : (
        <Cartao>
          <p className="font-medium">Painel não configurado.</p>
          <p className="mt-1 text-sm text-texto-suave">
            Defina a variável PAINEL_URL com o link público do painel, no formato
            https://&lt;pilha&gt;.grafana.net/public-dashboards/&lt;token&gt;, e reinicie a aplicação.
          </p>
        </Cartao>
      )}

      <section aria-labelledby="titulo-graficos" className="mt-8">
        <h2 id="titulo-graficos" className="text-xl font-semibold tracking-tight">
          Gráficos e filtros
        </h2>
        {dw.situacao === "sem-configuracao" ? (
          <Aviso className="mt-3">Gráficos indisponíveis: Data Warehouse não configurado.</Aviso>
        ) : dw.situacao === "falha" ? (
          <Aviso tipo="erro" className="mt-3">
            Gráficos indisponíveis: não foi possível consultar o Data Warehouse. Tente novamente em instantes.
          </Aviso>
        ) : (
          <>
            <CabecalhoGraficos dataReferencia={dw.dados.info.dataReferencia} carregadoEm={dw.dados.info.carregadoEm} />
            <Cartao className="mt-4">
              <FormularioFiltros opcoes={dw.opcoes} filtros={dw.filtros} />
            </Cartao>
            <div className="mt-4">
              <GraficosDw dados={dw.dados} filtros={dw.filtros} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
