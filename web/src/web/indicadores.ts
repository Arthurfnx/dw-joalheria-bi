// Preparação dos dados dos indicadores para a tela (RN-110 a RN-114): rótulos
// em português e uma série por gráfico, sempre numa única unidade. Sem React,
// para ser testado isoladamente.

import { formatarReais } from "./formatacao";

export type Medida = "PECAS" | "VALOR";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11" → "nov/26". */
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

/** "2026-11" → "novembro de 2026". */
export function rotuloMesLongo(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES_LONGOS[Number(m) - 1]} de ${a}`;
}

const INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarPecas(n: number): string {
  return `${INTEIRO.format(n)} ${n === 1 ? "peça" : "peças"}`;
}

const COMPACTO = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Rótulo curto de eixo: "R$ 12,5 mil" ou "1,2 mil". Só para leitura; o valor exato fica no texto. */
export function rotuloEixo(valor: number, unidade: Medida): string {
  const texto = valor >= 1000 ? COMPACTO.format(valor) : INTEIRO.format(valor);
  return unidade === "VALOR" ? `R$ ${texto}` : texto;
}

export function formatarPercentual(parte: number, todo: number): string {
  if (todo <= 0) return "0%";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((parte / todo) * 100)}%`;
}

export interface PontoGrafico {
  /** Rótulo curto do eixo (nov/26) ou nome do item. */
  rotulo: string;
  /** Rótulo completo para leitores de tela e dica (novembro de 2026). */
  rotuloLongo: string;
  /** Usado só para desenhar: posição e tamanho da marca. */
  valor: number;
  /** Valor exato formatado, exibido ao usuário. */
  texto: string;
}

export interface SerieGrafico {
  unidade: Medida;
  pontos: PontoGrafico[];
}

export interface MesVendas {
  mes: string;
  pecasTotal: number;
  valorTotal: string;
}

/**
 * RN-113 e RN-114: o gráfico de vendas soma as duas origens e mostra uma
 * única medida, peças ou reais, nunca as duas.
 */
export function serieVendas(meses: MesVendas[], medida: Medida): SerieGrafico {
  return {
    unidade: medida,
    pontos: meses.map((m) => ({
      rotulo: rotuloMes(m.mes),
      rotuloLongo: rotuloMesLongo(m.mes),
      valor: medida === "PECAS" ? m.pecasTotal : Number(m.valorTotal),
      texto: medida === "PECAS" ? formatarPecas(m.pecasTotal) : formatarReais(m.valorTotal),
    })),
  };
}

/** Estoque sempre em peças (RN-110). */
export function serieEstoque(itens: { nome: string; pecas: number }[]): SerieGrafico {
  return {
    unidade: "PECAS",
    pontos: itens.map((i) => ({ rotulo: i.nome, rotuloLongo: i.nome, valor: i.pecas, texto: formatarPecas(i.pecas) })),
  };
}

/** Topo do eixo e marcas "redondas" (1, 2 ou 5 × 10ⁿ), sempre inteiras: peças não se dividem. */
export function marcasDoEixo(maximo: number, quantidade = 4): number[] {
  if (maximo <= 0) return [0, 1];
  const bruto = maximo / quantidade;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((f) => f * potencia).find((p) => p >= bruto)!;
  const passoFinal = passo < 1 ? 1 : passo;
  const marcas: number[] = [];
  for (let v = 0; v < maximo + passoFinal; v += passoFinal) {
    marcas.push(v);
    if (v >= maximo) break;
  }
  return marcas;
}

/** Descrição acessível de uma série: período ou itens, maior valor e total. */
export function descreverSerie(serie: SerieGrafico, tipo: "tempo" | "itens", total: string): string {
  const p = serie.pontos;
  if (p.length === 0) return "Sem dados.";
  const maior = p.reduce((a, b) => (b.valor > a.valor ? b : a));
  const inicio =
    tipo === "tempo"
      ? `${p.length} meses, de ${p[0].rotuloLongo} a ${p[p.length - 1].rotuloLongo}.`
      : `${p.length} ${p.length === 1 ? "item" : "itens"}.`;
  return `${inicio} Maior: ${maior.rotuloLongo}, ${maior.texto}. Total: ${total}.`;
}
