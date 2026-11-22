// Vendas (RN-40 a RN-47, RN-64, RN-69). A escrita é sempre das funções
// app.confirmar_venda e app.cancelar_venda: a aplicação não grava venda,
// item, movimentação nem saldo diretamente (E1).

import { sql } from "kysely";
import { z } from "zod";
import type { Bd } from "../bd/conexao";
import { ErroNaoEncontrado, traduzirErroBanco } from "../erros";
import { exigirPermissao, type Ator } from "../permissoes";
import { esquemaDataNegocio, esquemaDinheiro, esquemaId, validar } from "../validacao";

const esquemaConfirmar = z.object({
  chave: z.string({ error: "Chave da venda ausente." }).uuid({ error: "Chave da venda inválida." }),
  dataVenda: esquemaDataNegocio,
  observacao: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v ?? null),
    z.string().trim().max(500, { error: "A observação deve ter no máximo 500 caracteres." }).nullable(),
  ),
  itens: z
    .array(
      z.object({
        produtoId: esquemaId,
        quantidade: z.coerce
          .number({ error: "Quantidade inválida." })
          .int({ error: "A quantidade deve ser inteira." })
          .min(1, { error: "A quantidade deve ser maior que zero." })
          .max(100000),
        precoPraticado: esquemaDinheiro,
      }),
      { error: "Itens inválidos." },
    )
    .min(1, { error: "Inclua pelo menos um produto na venda." })
    .refine((itens) => new Set(itens.map((i) => i.produtoId)).size === itens.length, {
      error: "O mesmo produto aparece mais de uma vez na venda.",
    }),
});

/** RN-42 e RN-43: devolve a venda gravada; com a mesma chave, a mesma venda. */
export async function confirmarVenda(bd: Bd, ator: Ator, entrada: unknown): Promise<{ id: string; numero: string }> {
  exigirPermissao(ator, "vendas.registrar");
  const d = validar(esquemaConfirmar, entrada);
  const itens = d.itens.map((i) => ({ produto_id: i.produtoId, quantidade: i.quantidade, preco_praticado: i.precoPraticado }));
  try {
    const { rows } = await sql<{ id: string }>`
      select app.confirmar_venda(${d.chave}::uuid, ${ator.id}::bigint, ${d.dataVenda}::date,
        ${d.observacao}, ${JSON.stringify(itens)}::jsonb) as id
    `.execute(bd);
    const venda = await bd.selectFrom("app.venda").select(["id", "numero"]).where("id", "=", rows[0].id).executeTakeFirstOrThrow();
    return venda;
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
}

/** RN-45 e RN-46: cancelamento inteiro, só do administrador, com motivo. */
export async function cancelarVenda(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "vendas.cancelar");
  const d = validar(
    z.object({
      id: esquemaId,
      motivo: z.string({ error: "Informe o motivo." }).trim().min(1, { error: "Informe o motivo." }).max(500),
    }),
    entrada,
  );
  try {
    await sql`select app.cancelar_venda(${d.id}::bigint, ${ator.id}::bigint, ${d.motivo})`.execute(bd);
  } catch (erro) {
    throw traduzirErroBanco(erro);
  }
}

const esquemaFiltro = z
  .object({
    de: esquemaDataNegocio,
    ate: esquemaDataNegocio,
    situacao: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["CONFIRMADA", "CANCELADA"]).optional()),
  })
  .refine((f) => f.de <= f.ate, { error: "A data inicial deve ser anterior ou igual à final." });

export const LIMITE_LISTA_VENDAS = 300;

export interface VendaDaLista {
  id: string;
  numero: string;
  dataVenda: string;
  vendedorNome: string;
  quantidadeItens: number;
  valorTotal: string;
  situacao: "CONFIRMADA" | "CANCELADA";
}

/**
 * RN-47: vendas da aplicação no período (pela data da venda). As vendas
 * anteriores da planilha (venda_historica) não entram: não são vendas da aplicação.
 */
export async function listarVendas(bd: Bd, ator: Ator, filtro: unknown) {
  exigirPermissao(ator, "vendas.consultar");
  const f = validar(esquemaFiltro, filtro);
  let consulta = bd
    .selectFrom("app.venda as v")
    .innerJoin("app.usuario as u", "u.id", "v.vendedor_id")
    .select([
      "v.id",
      "v.numero",
      "v.data_venda as dataVenda",
      "u.nome as vendedorNome",
      sql<number>`(select coalesce(sum(vi.quantidade), 0)::int from app.venda_item vi where vi.venda_id = v.id)`.as("quantidadeItens"),
      "v.valor_total as valorTotal",
      "v.situacao",
    ])
    .where("v.data_venda", ">=", f.de)
    .where("v.data_venda", "<=", f.ate);
  if (f.situacao) consulta = consulta.where("v.situacao", "=", f.situacao);
  const linhas = await consulta.orderBy("v.data_venda", "desc").orderBy("v.numero", "desc").limit(LIMITE_LISTA_VENDAS + 1).execute();
  return { vendas: linhas.slice(0, LIMITE_LISTA_VENDAS) as VendaDaLista[], limiteAtingido: linhas.length > LIMITE_LISTA_VENDAS };
}

export async function obterVenda(bd: Bd, ator: Ator, idEntrada: unknown) {
  exigirPermissao(ator, "vendas.consultar");
  const id = validar(esquemaId, idEntrada);
  const venda = await bd
    .selectFrom("app.venda as v")
    .innerJoin("app.usuario as u", "u.id", "v.vendedor_id")
    .leftJoin("app.usuario as c", "c.id", "v.cancelada_por")
    .select([
      "v.id",
      "v.numero",
      "v.data_venda as dataVenda",
      "v.situacao",
      "v.valor_total as valorTotal",
      "v.observacao",
      "v.registrada_em as registradaEm",
      "u.nome as vendedorNome",
      "v.cancelada_em as canceladaEm",
      "c.nome as canceladaPor",
      "v.motivo_cancelamento as motivoCancelamento",
    ])
    .where("v.id", "=", id)
    .executeTakeFirst();
  if (!venda) throw new ErroNaoEncontrado("Venda não encontrada.");
  const itens = await bd
    .selectFrom("app.venda_item as vi")
    .innerJoin("app.produto as p", "p.id", "vi.produto_id")
    .select([
      "vi.id",
      "p.id as produtoId",
      "p.codigo",
      "p.descricao",
      "vi.quantidade",
      "vi.preco_tabela as precoTabela",
      "vi.preco_praticado as precoPraticado",
      "vi.valor_item as valorItem",
    ])
    .where("vi.venda_id", "=", id)
    .orderBy("vi.id")
    .execute();
  return { venda, itens };
}

/** RN-64: vendas confirmadas da aplicação no dia e no mês, pela data da venda, no fuso de São Paulo. */
export async function totaisDeVendas(bd: Bd, ator: Ator) {
  exigirPermissao(ator, "vendas.consultar");
  const { rows } = await sql<{ qtd_dia: number; valor_dia: string; qtd_mes: number; valor_mes: string }>`
    with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
    select count(*) filter (where v.data_venda = hoje.d)::int as qtd_dia,
           coalesce(sum(v.valor_total) filter (where v.data_venda = hoje.d), 0)::numeric(14,2)::text as valor_dia,
           count(*) filter (where date_trunc('month', v.data_venda) = date_trunc('month', hoje.d))::int as qtd_mes,
           coalesce(sum(v.valor_total) filter (where date_trunc('month', v.data_venda) = date_trunc('month', hoje.d)), 0)::numeric(14,2)::text as valor_mes
      from hoje left join app.venda v on v.situacao = 'CONFIRMADA'
  `.execute(bd);
  const r = rows[0];
  return { dia: { quantidade: r.qtd_dia, valor: r.valor_dia }, mes: { quantidade: r.qtd_mes, valor: r.valor_mes } };
}

export interface ProdutoParaVenda {
  id: string;
  codigo: string;
  descricao: string;
  saldo: number;
  modoControle: "UNITARIO" | "QUANTIDADE";
  /** RN-41 e RN-69: preço de venda do cadastro; sem ele, o preço sugerido; sem os dois, null. */
  precoTabela: string | null;
}

/** Busca da nova venda: produtos ativos com saldo, por início do código ou trecho da descrição. */
export async function buscarProdutosParaVenda(bd: Bd, ator: Ator, termoEntrada: unknown): Promise<ProdutoParaVenda[]> {
  exigirPermissao(ator, "vendas.registrar");
  const termo = validar(z.string().trim().min(1).max(100), termoEntrada);
  const literal = termo.replace(/[\\%_]/g, (c) => `\\${c}`);
  return bd
    .selectFrom("app.produto as p")
    .innerJoin("app.saldo_estoque as s", "s.produto_id", "p.id")
    .select([
      "p.id",
      "p.codigo",
      "p.descricao",
      "s.quantidade as saldo",
      "p.modo_controle as modoControle",
      sql<string | null>`coalesce(p.preco_venda, app.preco_sugerido(p.id))`.as("precoTabela"),
    ])
    .where("p.ativo", "=", true)
    .where("s.quantidade", ">", 0)
    .where((eb) => eb.or([eb("p.codigo", "like", `${literal.toUpperCase()}%`), eb("p.descricao", "ilike", `%${literal}%`)]))
    .orderBy("p.codigo")
    .limit(20)
    .execute();
}
