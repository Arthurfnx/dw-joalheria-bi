// Filtros dos gráficos da tela Relatórios (Material, Tipo de peça e Ano).
// Vêm da URL e só são aceitos se constarem das listas lidas do próprio Data
// Warehouse; qualquer outro valor equivale a "Todos". Sem React nem banco,
// para ser testado isoladamente.

export type ParametrosUrl = Record<string, string | string[] | undefined>;

export interface OpcoesFiltro {
  materiais: string[];
  tipos: string[];
  anos: string[];
}

/** `null` = "Todos". */
export interface FiltrosRelatorio {
  material: string | null;
  tipo: string | null;
  ano: string | null;
}

export const FILTROS_TODOS: FiltrosRelatorio = { material: null, tipo: null, ano: null };

function unico(valor: string | string[] | undefined): string {
  // Seleção única: se a URL repetir o parâmetro, vale o primeiro.
  const v = Array.isArray(valor) ? valor[0] : valor;
  return typeof v === "string" ? v.trim() : "";
}

function aceito(valor: string, lista: string[]): string | null {
  return valor !== "" && lista.includes(valor) ? valor : null;
}

export function lerFiltros(parametros: ParametrosUrl, opcoes: OpcoesFiltro): FiltrosRelatorio {
  return {
    material: aceito(unico(parametros.material), opcoes.materiais),
    tipo: aceito(unico(parametros.tipo), opcoes.tipos),
    ano: aceito(unico(parametros.ano), opcoes.anos),
  };
}

/**
 * Parâmetros posicionais das consultas: $1 material, $2 tipo de peça, $3 ano.
 * `null` desliga o filtro no SQL (`$1::text IS NULL OR …`); o texto do usuário
 * nunca é concatenado na consulta.
 */
export function parametrosConsulta(f: FiltrosRelatorio): [string | null, string | null, number | null] {
  return [f.material, f.tipo, f.ano === null ? null : Number(f.ano)];
}

/** Descrição curta dos filtros ativos, para títulos e leitores de tela. */
export function descreverFiltros(f: FiltrosRelatorio): string {
  const partes = [
    f.material ? `material ${f.material}` : null,
    f.tipo ? `tipo ${f.tipo}` : null,
    f.ano ? `ano ${f.ano}` : null,
  ].filter(Boolean);
  return partes.length === 0 ? "todos os dados" : partes.join(", ");
}
