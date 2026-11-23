// Consultas dos gráficos da tela Relatórios, lidas do Data Warehouse (views do
// esquema bi). Mesmas fórmulas do painel do Grafana (tools/grafana/consultas_completo),
// aqui parametrizadas: $1 material, $2 tipo de peça, $3 ano; `null` = "Todos".
//
// Regras comuns:
// - Receita = valor_faturado: vendas simbólicas (R$ 0,01) e sem valor ficam fora da
//   receita, mas contam como peças vendidas. Vendas canceladas já estão fora do DW.
// - "Hoje" = data de referência da última carga (dia do último retrato do estoque).
// - Valores em R$ trafegam como texto (numeric), nunca como ponto flutuante.
// - Nenhuma coluna de custo nem nome de pessoa é lida.

import type { FiltrosRelatorio, OpcoesFiltro } from "@/web/filtros-relatorios";
import { parametrosConsulta } from "@/web/filtros-relatorios";

/** O que as consultas precisam do pool: só `query`. */
export interface ConsultorDw {
  query<T extends object>(sql: string, parametros?: unknown[]): Promise<{ rows: T[] }>;
}

export const LIMITE_PARADOS = 50;

const FILTRO_PRODUTO = `($1::text IS NULL OR p.material = $1::text)
   AND ($2::text IS NULL OR p.tipo_peca = $2::text)`;
const FILTRO_ANO = `($3::int IS NULL OR extract(year FROM v.data_hora_venda)::int = $3::int)`;

const REF = `ref AS (
    SELECT max(data_key) AS data_key, to_date(max(data_key)::text, 'YYYYMMDD') AS data_ref
      FROM bi.vw_fato_snapshot_estoque
)`;

/** Vendas dentro dos três filtros, com o produto. */
const VENDAS_FILTRADAS = `vf AS (
    SELECT v.data_hora_venda, v.quantidade_vendida, v.valor_faturado, v.entra_faturamento,
           p.material, p.tipo_peca, p.data_aquisicao, p.codigo_produto, p.descricao
      FROM bi.vw_fato_venda_item v
      JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
     WHERE ${FILTRO_PRODUTO}
       AND ${FILTRO_ANO}
)`;

/** Estoque do último retrato, dentro de Material e Tipo de peça (Ano não se aplica). */
const ESTOQUE_HOJE = `eh AS (
    SELECT p.material, p.tipo_peca, p.data_aquisicao, s.quantidade_em_estoque AS qtd,
           ref.data_ref - p.data_aquisicao AS dias
      FROM ref
      JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key AND s.quantidade_em_estoque > 0
      JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
     WHERE ${FILTRO_PRODUTO}
)`;

export async function opcoesFiltro(dw: ConsultorDw): Promise<OpcoesFiltro> {
  const [materiais, tipos, anos] = await Promise.all([
    dw.query<{ v: string }>(
      "SELECT DISTINCT material AS v FROM bi.vw_dim_produto WHERE material IS NOT NULL ORDER BY 1",
    ),
    dw.query<{ v: string }>(
      "SELECT DISTINCT tipo_peca AS v FROM bi.vw_dim_produto WHERE tipo_peca IS NOT NULL ORDER BY 1",
    ),
    dw.query<{ v: string }>(
      "SELECT DISTINCT extract(year FROM data_hora_venda)::int::text AS v FROM bi.vw_fato_venda_item ORDER BY 1 DESC",
    ),
  ]);
  return {
    materiais: materiais.rows.map((r) => r.v),
    tipos: tipos.rows.map((r) => r.v),
    anos: anos.rows.map((r) => r.v),
  };
}

export interface InfoCarga {
  dataReferencia: string | null;
  status: string | null;
  carregadoEm: string | null;
}

export async function infoCarga(dw: ConsultorDw): Promise<InfoCarga> {
  const { rows } = await dw.query<InfoCarga>(
    `SELECT to_char(data_referencia, 'YYYY-MM-DD') AS "dataReferencia",
            status_ultima_execucao AS status,
            to_char(ultima_carga_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "carregadoEm"
       FROM bi.vw_info_ambiente`,
  );
  return rows[0] ?? { dataReferencia: null, status: null, carregadoEm: null };
}

export interface TotaisVendas {
  receita: string;
  pecas: number;
  pecasSemReceita: number;
  /** Linhas de venda (itens vendidos) dentro dos filtros. */
  itens: number;
  primeiroMes: string | null;
  ultimoMes: string | null;
  /** Peças em estoque hoje, dentro de Material e Tipo de peça. */
  pecasEmEstoque: number;
}

export async function totaisVendas(dw: ConsultorDw, f: FiltrosRelatorio): Promise<TotaisVendas> {
  const p = parametrosConsulta(f);
  const [vendas, estoque] = await Promise.all([
    dw.query<Omit<TotaisVendas, "pecasEmEstoque">>(
      `WITH ${VENDAS_FILTRADAS}
       SELECT COALESCE(sum(valor_faturado), 0)::numeric(14,2)::text AS receita,
              COALESCE(sum(quantidade_vendida), 0)::int AS pecas,
              COALESCE(sum(quantidade_vendida) FILTER (WHERE NOT entra_faturamento), 0)::int AS "pecasSemReceita",
              count(*)::int AS itens,
              to_char(min(data_hora_venda), 'YYYY-MM') AS "primeiroMes",
              to_char(max(data_hora_venda), 'YYYY-MM') AS "ultimoMes"
         FROM vf`,
      p,
    ),
    dw.query<{ pecas: number }>(
      `WITH ${REF}, ${ESTOQUE_HOJE} SELECT COALESCE(sum(qtd), 0)::int AS pecas FROM eh`,
      p.slice(0, 2),
    ),
  ]);
  return { ...vendas.rows[0], pecasEmEstoque: estoque.rows[0].pecas };
}

export interface MesVendasDw {
  /** AAAA-MM. */
  mes: string;
  pecas: number;
  receita: string;
}

/** Do primeiro ao último mês com venda dentro dos filtros; meses sem venda aparecem com zero. */
export async function vendasPorMes(dw: ConsultorDw, f: FiltrosRelatorio): Promise<MesVendasDw[]> {
  const { rows } = await dw.query<MesVendasDw>(
    `WITH ${VENDAS_FILTRADAS},
     meses AS (
         SELECT generate_series(date_trunc('month', min(data_hora_venda)),
                                date_trunc('month', max(data_hora_venda)),
                                interval '1 month')::date AS mes
           FROM vf
     )
     SELECT to_char(m.mes, 'YYYY-MM') AS mes,
            COALESCE(sum(vf.quantidade_vendida), 0)::int AS pecas,
            COALESCE(sum(vf.valor_faturado), 0)::numeric(14,2)::text AS receita
       FROM meses m
       LEFT JOIN vf ON date_trunc('month', vf.data_hora_venda)::date = m.mes
      GROUP BY m.mes
      ORDER BY m.mes`,
    parametrosConsulta(f),
  );
  return rows;
}

export interface AnoVendas {
  /** AAAA. */
  ano: string;
  pecas: number;
  receita: string;
  /** T1 a T4, sempre os quatro, com zero onde não houve venda. */
  trimestres: { trimestre: number; pecas: number; receita: string }[];
}

/** Nível Ano da hierarquia de data, com os totais por trimestre do ano. */
export async function vendasPorAno(dw: ConsultorDw, f: FiltrosRelatorio): Promise<AnoVendas[]> {
  const { rows } = await dw.query<{ ano: string; trimestre: number; pecas: number; receita: string }>(
    `WITH ${VENDAS_FILTRADAS},
     anos AS (SELECT DISTINCT extract(year FROM data_hora_venda)::int AS ano FROM vf)
     SELECT a.ano::text AS ano, t.trimestre,
            COALESCE(sum(vf.quantidade_vendida), 0)::int AS pecas,
            COALESCE(sum(vf.valor_faturado), 0)::numeric(14,2)::text AS receita
       FROM anos a
      CROSS JOIN generate_series(1, 4) AS t(trimestre)
       LEFT JOIN vf ON extract(year FROM vf.data_hora_venda)::int = a.ano
                   AND extract(quarter FROM vf.data_hora_venda)::int = t.trimestre
      GROUP BY a.ano, t.trimestre
      ORDER BY a.ano, t.trimestre`,
    parametrosConsulta(f),
  );
  const anos = new Map<string, AnoVendas>();
  for (const r of rows) {
    const a = anos.get(r.ano) ?? { ano: r.ano, pecas: 0, receita: "0.00", trimestres: [] };
    a.trimestres.push({ trimestre: r.trimestre, pecas: r.pecas, receita: r.receita });
    a.pecas += r.pecas;
    a.receita = somarReais(a.receita, r.receita);
    anos.set(r.ano, a);
  }
  return [...anos.values()];
}

/** Soma de dois valores em R$ (texto com duas casas) em centavos inteiros, sem ponto flutuante. */
export function somarReais(a: string, b: string): string {
  const centavos = (v: string) => BigInt(v.replace(".", ""));
  const total = centavos(a) + centavos(b);
  const negativo = total < BigInt(0);
  const texto = (negativo ? -total : total).toString().padStart(3, "0");
  return `${negativo ? "-" : ""}${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

export const LIMITE_PRODUTOS = 20;

export interface ProdutoVendido {
  codigo: string;
  descricao: string;
  pecas: number;
  receita: string;
}

export interface ProdutosVendidos {
  /** Produtos distintos vendidos dentro dos filtros (antes do limite). */
  total: number;
  linhas: ProdutoVendido[];
}

/** Nível Produto da hierarquia de produto: os mais vendidos em receita dentro dos filtros. */
export async function produtosVendidos(
  dw: ConsultorDw,
  f: FiltrosRelatorio,
  limite = LIMITE_PRODUTOS,
): Promise<ProdutosVendidos> {
  const { rows } = await dw.query<ProdutoVendido & { total: number }>(
    `WITH ${VENDAS_FILTRADAS},
     g AS (
         SELECT codigo_produto AS codigo, descricao,
                sum(quantidade_vendida)::int AS pecas,
                COALESCE(sum(valor_faturado), 0)::numeric(14,2) AS receita
           FROM vf
          GROUP BY codigo_produto, descricao
     )
     SELECT codigo, descricao, pecas, receita::text AS receita, (count(*) OVER ())::int AS total
       FROM g
      ORDER BY g.receita DESC, pecas DESC, codigo
      LIMIT $4::int`,
    [...parametrosConsulta(f), limite],
  );
  return { total: rows[0]?.total ?? 0, linhas: rows.map((r) => ({ codigo: r.codigo, descricao: r.descricao, pecas: r.pecas, receita: r.receita })) };
}

export interface VendasAgrupadas {
  nome: string;
  pecas: number;
  receita: string;
}

/** Peças e receita por tipo de peça ou por material. */
export async function vendasPor(
  dw: ConsultorDw,
  f: FiltrosRelatorio,
  grupo: "tipo_peca" | "material",
): Promise<VendasAgrupadas[]> {
  // `grupo` é um dos dois nomes fixos acima, nunca texto do usuário.
  const coluna = grupo === "material" ? "material" : "tipo_peca";
  const { rows } = await dw.query<VendasAgrupadas>(
    `WITH ${VENDAS_FILTRADAS}
     SELECT ${coluna} AS nome,
            sum(quantidade_vendida)::int AS pecas,
            COALESCE(sum(valor_faturado), 0)::numeric(14,2)::text AS receita
       FROM vf
      GROUP BY ${coluna}
      ORDER BY 2 DESC, 1`,
    parametrosConsulta(f),
  );
  return rows;
}

export interface TaxaVenda {
  tipo: string;
  vendidas: number;
  emEstoque: number;
  /** Percentual com uma casa, em texto (ex.: "12.5"). */
  taxa: string;
  amostra: number;
  mediaDias: string | null;
  medianaDias: string | null;
}

/**
 * Taxa de venda = peças vendidas (no ano escolhido) ÷ (vendidas + em estoque hoje).
 * Tempo até a venda = data da venda − data de aquisição, só para vendas com data
 * de aquisição não posterior à venda. Não é o giro de estoque tradicional.
 */
export async function taxaVendaPorTipo(dw: ConsultorDw, f: FiltrosRelatorio): Promise<TaxaVenda[]> {
  const { rows } = await dw.query<TaxaVenda>(
    `WITH ${REF}, ${VENDAS_FILTRADAS}, ${ESTOQUE_HOJE},
     estoque AS (SELECT tipo_peca, sum(qtd) AS pecas FROM eh GROUP BY tipo_peca),
     venda AS (
         SELECT tipo_peca,
                sum(quantidade_vendida) AS pecas,
                count(*) FILTER (WHERE data_aquisicao <= data_hora_venda::date) AS amostra,
                avg(data_hora_venda::date - data_aquisicao)
                    FILTER (WHERE data_aquisicao <= data_hora_venda::date) AS media,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY data_hora_venda::date - data_aquisicao)
                    FILTER (WHERE data_aquisicao <= data_hora_venda::date) AS mediana
           FROM vf
          GROUP BY tipo_peca
     ),
     t AS (
         SELECT COALESCE(v.tipo_peca, e.tipo_peca) AS tipo,
                COALESCE(v.pecas, 0) AS vendidas,
                COALESCE(e.pecas, 0) AS em_estoque,
                COALESCE(v.amostra, 0) AS amostra,
                v.media, v.mediana
           FROM venda v
           FULL JOIN estoque e ON e.tipo_peca = v.tipo_peca
     )
     SELECT tipo,
            vendidas::int AS vendidas,
            em_estoque::int AS "emEstoque",
            round(100.0 * vendidas / (vendidas + em_estoque), 1)::text AS taxa,
            amostra::int AS amostra,
            round(media::numeric, 1)::text AS "mediaDias",
            round(mediana::numeric, 1)::text AS "medianaDias"
       FROM t
      WHERE vendidas + em_estoque > 0
      ORDER BY vendidas::numeric / (vendidas + em_estoque) DESC, vendidas DESC, tipo`,
    parametrosConsulta(f),
  );
  return rows;
}

export interface ProdutoParado {
  material: string;
  tipo: string;
  codigo: string;
  descricao: string;
  pecas: number;
  dias: number;
}

export interface Parados {
  /** Total de produtos parados com data de aquisição (antes do limite). */
  total: number;
  linhas: ProdutoParado[];
  /** Peças em estoque sem data de aquisição, por tipo de peça (fora do cálculo). */
  semData: { tipo: string; pecas: number }[];
}

/** Dias parado = data de referência da carga − data de aquisição; os mais antigos primeiro. */
export async function produtosParados(dw: ConsultorDw, f: FiltrosRelatorio, limite = LIMITE_PARADOS): Promise<Parados> {
  const p = parametrosConsulta(f).slice(0, 2);
  const [linhas, total, semData] = await Promise.all([
    dw.query<ProdutoParado>(
      `WITH ${REF}
       SELECT p.material, p.tipo_peca AS tipo, p.codigo_produto AS codigo, p.descricao,
              s.quantidade_em_estoque AS pecas, (ref.data_ref - p.data_aquisicao)::int AS dias
         FROM ref
         JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key AND s.quantidade_em_estoque > 0
         JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
        WHERE p.data_aquisicao IS NOT NULL
          AND ${FILTRO_PRODUTO}
        ORDER BY ref.data_ref - p.data_aquisicao DESC, p.material, p.tipo_peca, p.codigo_produto
        LIMIT $3::int`,
      [...p, limite],
    ),
    dw.query<{ n: number }>(
      `WITH ${REF}, ${ESTOQUE_HOJE} SELECT count(*)::int AS n FROM eh WHERE data_aquisicao IS NOT NULL`,
      p,
    ),
    dw.query<{ tipo: string; pecas: number }>(
      `WITH ${REF}, ${ESTOQUE_HOJE}
       SELECT tipo_peca AS tipo, sum(qtd)::int AS pecas
         FROM eh WHERE data_aquisicao IS NULL
        GROUP BY tipo_peca ORDER BY 2 DESC, 1`,
      p,
    ),
  ]);
  return { total: total.rows[0].n, linhas: linhas.rows, semData: semData.rows };
}

export interface TipoParado {
  tipo: string;
  comData: number;
  mediana: string;
  media: string;
  /** % das peças com data que estão paradas há mais de 180 dias, uma casa. */
  acima180: string;
  semData: number;
}

export async function tipoMaisParado(dw: ConsultorDw, f: FiltrosRelatorio): Promise<TipoParado[]> {
  const { rows } = await dw.query<TipoParado>(
    `WITH ${REF}, ${ESTOQUE_HOJE},
     t AS (
         SELECT tipo_peca,
                sum(qtd) FILTER (WHERE dias IS NOT NULL) AS com_data,
                sum(qtd) FILTER (WHERE dias IS NULL) AS sem_data,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS mediana,
                avg(dias) AS media,
                sum(qtd) FILTER (WHERE dias > 180) AS acima_180
           FROM eh
          GROUP BY tipo_peca
     )
     SELECT tipo_peca AS tipo,
            com_data::int AS "comData",
            round(mediana::numeric, 1)::text AS mediana,
            round(media::numeric, 1)::text AS media,
            round(100.0 * COALESCE(acima_180, 0) / com_data, 1)::text AS acima180,
            COALESCE(sem_data, 0)::int AS "semData"
       FROM t
      WHERE com_data > 0
      ORDER BY t.mediana DESC, t.media DESC, tipo_peca`,
    parametrosConsulta(f).slice(0, 2),
  );
  return rows;
}

export interface MesDoAno {
  /** 1 a 12. */
  mes: number;
  pecas: number;
  receita: string;
}

/** Peças e receita por mês do ano (jan a dez), somando os anos dentro do filtro. */
export async function sazonalidade(dw: ConsultorDw, f: FiltrosRelatorio): Promise<MesDoAno[]> {
  const { rows } = await dw.query<MesDoAno>(
    `WITH ${VENDAS_FILTRADAS}
     SELECT m.mes,
            COALESCE(sum(vf.quantidade_vendida), 0)::int AS pecas,
            COALESCE(sum(vf.valor_faturado), 0)::numeric(14,2)::text AS receita
       FROM generate_series(1, 12) AS m(mes)
       LEFT JOIN vf ON extract(month FROM vf.data_hora_venda)::int = m.mes
      GROUP BY m.mes
      ORDER BY m.mes`,
    parametrosConsulta(f),
  );
  return rows;
}

export interface LinhaReposicao {
  material: string;
  tipo: string;
  estoque: number;
  vendidas12m: number;
  /** Meses, uma casa; `null` sem vendas em 12 meses. */
  cobertura: string | null;
  repor: boolean;
}

/**
 * Proposta (a confirmar com o proprietário): cobertura = estoque atual ÷
 * (vendidas nos 12 meses anteriores à data de referência ÷ 12); abaixo de 3 meses = repor.
 */
export async function reposicao(dw: ConsultorDw, f: FiltrosRelatorio): Promise<LinhaReposicao[]> {
  const { rows } = await dw.query<LinhaReposicao>(
    `WITH ${REF},
     estoque AS (
         SELECT p.material, p.tipo_peca, sum(s.quantidade_em_estoque) AS pecas
           FROM ref
           JOIN bi.vw_fato_snapshot_estoque s ON s.data_key = ref.data_key
           JOIN bi.vw_dim_produto p ON p.produto_key = s.produto_key
          WHERE ${FILTRO_PRODUTO}
          GROUP BY p.material, p.tipo_peca
     ),
     venda AS (
         SELECT p.material, p.tipo_peca, sum(v.quantidade_vendida) AS pecas
           FROM ref
           JOIN bi.vw_fato_venda_item v
             ON v.data_hora_venda::date >  (ref.data_ref - interval '12 months')::date
            AND v.data_hora_venda::date <= ref.data_ref
           JOIN bi.vw_dim_produto p ON p.produto_key = v.produto_key
          WHERE ${FILTRO_PRODUTO}
          GROUP BY p.material, p.tipo_peca
     ),
     t AS (
         SELECT COALESCE(e.material, v.material) AS material,
                COALESCE(e.tipo_peca, v.tipo_peca) AS tipo,
                COALESCE(e.pecas, 0) AS estoque,
                COALESCE(v.pecas, 0) AS vendidas_12m,
                CASE WHEN COALESCE(v.pecas, 0) > 0 THEN COALESCE(e.pecas, 0) / (v.pecas / 12.0) END AS cobertura
           FROM estoque e
           FULL JOIN venda v ON v.material = e.material AND v.tipo_peca = e.tipo_peca
     )
     SELECT material, tipo,
            estoque::int AS estoque,
            vendidas_12m::int AS "vendidas12m",
            round(cobertura, 1)::text AS cobertura,
            COALESCE(cobertura < 3, false) AS repor
       FROM t
      WHERE estoque > 0 OR vendidas_12m > 0
      ORDER BY t.cobertura ASC NULLS LAST, estoque DESC, material, tipo`,
    parametrosConsulta(f).slice(0, 2),
  );
  return rows;
}

export interface RelatoriosDw {
  info: InfoCarga;
  totais: TotaisVendas;
  meses: MesVendasDw[];
  /** Vazio quando o Ano está escolhido (nível do mês). */
  anos: AnoVendas[];
  /** `null` fora do nível Produto (Tipo de peça não escolhido). */
  produtos: ProdutosVendidos | null;
  porTipo: VendasAgrupadas[];
  porMaterial: VendasAgrupadas[];
  taxa: TaxaVenda[];
  parados: Parados;
  tipoParado: TipoParado[];
  sazonalidade: MesDoAno[];
  reposicao: LinhaReposicao[];
}

export async function carregarRelatorios(dw: ConsultorDw, f: FiltrosRelatorio): Promise<RelatoriosDw> {
  const [info, totais, meses, anos, produtos, porTipo, porMaterial, taxa, parados, tipoParado, saz, repo] = await Promise.all([
    infoCarga(dw),
    totaisVendas(dw, f),
    vendasPorMes(dw, f),
    f.ano ? Promise.resolve([]) : vendasPorAno(dw, f),
    f.tipo ? produtosVendidos(dw, f) : Promise.resolve(null),
    vendasPor(dw, f, "tipo_peca"),
    vendasPor(dw, f, "material"),
    taxaVendaPorTipo(dw, f),
    produtosParados(dw, f),
    tipoMaisParado(dw, f),
    sazonalidade(dw, f),
    reposicao(dw, f),
  ]);
  return { info, totais, meses, anos, produtos, porTipo, porMaterial, taxa, parados, tipoParado, sazonalidade: saz, reposicao: repo };
}
