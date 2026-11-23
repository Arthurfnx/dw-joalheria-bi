// Indicadores (RN-110 a RN-115): consultas só de leitura no banco operacional.
// Valores em reais saem do banco como texto, já somados, e nunca passam por
// ponto flutuante. Nenhuma consulta lê custo (valor_aquisicao, valor_compra).

import { sql } from "kysely";
import type { Bd } from "../bd/conexao";
import { exigirPermissao, type Ator } from "../permissoes";

/** RN-113: período padrão, contando o mês corrente. */
export const MESES_VENDAS_POR_MES = 24;

export interface VendasDoMes {
  /** AAAA-MM */
  mes: string;
  pecasAplicacao: number;
  pecasPlanilha: number;
  pecasTotal: number;
  valorAplicacao: string;
  valorPlanilha: string;
  valorTotal: string;
}

export interface VendasPorMes {
  meses: VendasDoMes[];
  total: Omit<VendasDoMes, "mes">;
}

/**
 * RN-113: vendas confirmadas da aplicação e histórico da planilha, por mês da
 * data da venda, nos últimos 24 meses (o mês corrente incluído), no fuso de
 * São Paulo. Meses sem venda vêm com zero. Cada linha do histórico é uma peça
 * (RN-90). Venda simbólica (R$ 0,01) e venda sem valor contam na quantidade e
 * ficam fora do valor; na aplicação, um item de preço zero já soma zero.
 *
 * `hoje` (AAAA-MM-DD) fixa o mês de referência; sem ele, vale a data atual.
 */
export async function vendasPorMes(bd: Bd, ator: Ator, hoje?: string): Promise<VendasPorMes> {
  exigirPermissao(ator, "indicadores.ver");
  const referencia = hoje ?? null;
  const { rows } = await sql<VendasDoMes & { total: boolean }>`
    with limites as (
      select (date_trunc('month', coalesce(${referencia}::date, (now() at time zone 'America/Sao_Paulo')::date))
              - make_interval(months => ${sql.lit(MESES_VENDAS_POR_MES - 1)}))::date as inicio,
             (date_trunc('month', coalesce(${referencia}::date, (now() at time zone 'America/Sao_Paulo')::date))
              + interval '1 month')::date as fim
    ),
    meses as (
      select generate_series(l.inicio, l.fim - 1, interval '1 month')::date as mes from limites l
    ),
    da_aplicacao as (
      select date_trunc('month', v.data_venda)::date as mes,
             sum(vi.quantidade)::int as pecas,
             sum(vi.valor_item) as valor
        from app.venda v
        join app.venda_item vi on vi.venda_id = v.id
        cross join limites l
       where v.situacao = 'CONFIRMADA'
         and v.data_venda >= l.inicio and v.data_venda < l.fim
       group by 1
    ),
    da_planilha as (
      select date_trunc('month', h.data_venda)::date as mes,
             count(*)::int as pecas,
             sum(h.valor_venda) filter (where not h.simbolico) as valor
        from app.venda_historica h
        cross join limites l
       where h.data_venda >= l.inicio and h.data_venda < l.fim
       group by 1
    ),
    por_mes as (
      select m.mes,
             coalesce(a.pecas, 0) as pa, coalesce(p.pecas, 0) as pp,
             coalesce(a.valor, 0) as va, coalesce(p.valor, 0) as vp
        from meses m
        left join da_aplicacao a on a.mes = m.mes
        left join da_planilha p on p.mes = m.mes
    )
    select false as total, to_char(mes, 'YYYY-MM') as mes,
           pa as "pecasAplicacao", pp as "pecasPlanilha", pa + pp as "pecasTotal",
           va::numeric(14,2)::text as "valorAplicacao", vp::numeric(14,2)::text as "valorPlanilha",
           (va + vp)::numeric(14,2)::text as "valorTotal"
      from por_mes
    union all
    select true, null,
           sum(pa)::int, sum(pp)::int, sum(pa + pp)::int,
           sum(va)::numeric(14,2)::text, sum(vp)::numeric(14,2)::text, sum(va + vp)::numeric(14,2)::text
      from por_mes
    order by total, mes
  `.execute(bd);
  const linha = (r: VendasDoMes) => ({
    pecasAplicacao: r.pecasAplicacao,
    pecasPlanilha: r.pecasPlanilha,
    pecasTotal: r.pecasTotal,
    valorAplicacao: r.valorAplicacao,
    valorPlanilha: r.valorPlanilha,
    valorTotal: r.valorTotal,
  });
  return {
    meses: rows.filter((r) => !r.total).map((r) => ({ mes: r.mes, ...linha(r) })),
    total: linha(rows.find((r) => r.total)!),
  };
}

export interface ItemEstoque {
  nome: string;
  pecas: number;
}

export interface EstoqueAgrupado {
  itens: ItemEstoque[];
  totalPecas: number;
}

/**
 * RN-110: soma dos saldos dos produtos ativos com saldo, em peças, por
 * categoria ou por material, do maior para o menor. Peso não entra (RN-114).
 */
export async function estoquePor(bd: Bd, ator: Ator, dimensao: "categoria" | "material"): Promise<EstoqueAgrupado> {
  exigirPermissao(ator, "indicadores.ver");
  const tabela = dimensao === "categoria" ? sql.table("app.categoria") : sql.table("app.material");
  const coluna = dimensao === "categoria" ? sql.ref("p.categoria_id") : sql.ref("p.material_id");
  const { rows } = await sql<ItemEstoque>`
    select d.nome, sum(s.quantidade)::int as pecas
      from app.produto p
      join app.saldo_estoque s on s.produto_id = p.id
      join ${tabela} d on d.id = ${coluna}
     where p.ativo and s.quantidade > 0
     group by d.id, d.nome
     order by pecas desc, d.nome
  `.execute(bd);
  return { itens: rows, totalPecas: rows.reduce((soma, i) => soma + i.pecas, 0) };
}
