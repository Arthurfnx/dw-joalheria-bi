// Produtos (RN-20 a RN-25, RN-21A, RN-21B, RN-37, RN-68). O vendedor consulta,
// mas não vê valor de aquisição, custos nem com quem a peça está consignada.

import { sql } from "kysely";
import { z } from "zod";
import type { Bd, Trx } from "../bd/conexao";
import { registrarAuditoria } from "../auditoria";
import { ErroNaoEncontrado, ErroNegocio, ehViolacaoDeUnicidade, traduzirErroBanco } from "../erros";
import { exigirPermissao, temPermissao, type Ator } from "../permissoes";
import { esquemaId, validar } from "../validacao";

export const LOCAIS_ESTOQUE = ["Estoque", "Armário", "Maleta 1", "Maleta 2", "Consignado"] as const;
export const LIMITE_BUSCA_PRODUTOS = 200;

// ---------------------------------------------------------------------------
// Validação de entrada
// ---------------------------------------------------------------------------

const vazioParaNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

/** Decimal em texto: aceita "1.234,56", "1234,56" e "1234.56"; devolve com ponto. */
function decimal(rotulo: string, casas: number, inteiros: number) {
  return z.preprocess(
    vazioParaNulo,
    z
      .string({ error: `${rotulo} inválido.` })
      .trim()
      .transform((v) => (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
      .refine((v) => new RegExp(`^\\d{1,${inteiros}}(\\.\\d{1,${casas}})?$`).test(v), {
        error: `${rotulo} inválido: use números com até ${casas} casas decimais.`,
      })
      .nullable(),
  );
}

const textoOpcional = (max: number) =>
  z.preprocess(vazioParaNulo, z.string().trim().max(max, { error: `Texto com mais de ${max} caracteres.` }).nullable());

const idOpcional = z.preprocess(vazioParaNulo, esquemaId.nullable());

const esquemaData = z.preprocess(
  vazioParaNulo,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." })
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Data inválida." })
    .nullable(),
);

const esquemaCamposProduto = z
  .object({
    codigo: z
      .string({ error: "Informe o código." })
      .trim()
      .toUpperCase()
      .min(1, { error: "Informe o código." })
      .max(40, { error: "O código deve ter no máximo 40 caracteres." }),
    descricao: z
      .string({ error: "Informe a descrição." })
      .trim()
      .min(1, { error: "Informe a descrição." })
      .max(300, { error: "A descrição deve ter no máximo 300 caracteres." }),
    materialId: esquemaId,
    categoriaId: esquemaId,
    subcategoriaId: idOpcional,
    modoControle: z.enum(["UNITARIO", "QUANTIDADE"], { error: "Escolha o modo de controle." }),
    pesoGramas: decimal("Peso", 3, 7),
    tamanho: textoOpcional(20),
    pedras: textoOpcional(300),
    precoVenda: decimal("Preço de venda", 2, 12),
    estoqueMinimo: z.preprocess(
      vazioParaNulo,
      z.coerce.number().int({ error: "Estoque mínimo deve ser inteiro." }).min(0).max(100000).nullable(),
    ),
    observacao: textoOpcional(1000),
    indicePreco: decimal("Índice de preço", 4, 10),
    valorAquisicao: decimal("Valor de aquisição", 2, 12),
    dataAquisicao: esquemaData,
    localEstoque: z.preprocess(vazioParaNulo, z.enum(LOCAIS_ESTOQUE, { error: "Local inválido." }).nullable()),
    consignadoCom: textoOpcional(120),
  })
  .refine((d) => (d.localEstoque === "Consignado") === (d.consignadoCom !== null), {
    error: "Informe com quem a peça está consignada (e só quando o local for Consignado).",
  });

const esquemaCriarProduto = z.object({
  produto: esquemaCamposProduto,
  saldoInicial: z.preprocess(
    vazioParaNulo,
    z.coerce.number().int({ error: "O saldo inicial deve ser inteiro." }).min(0).max(100000).nullable(),
  ),
});

type CamposProduto = z.output<typeof esquemaCamposProduto>;

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

const CAMPOS_AUDITADOS = [
  "id", "codigo", "descricao", "material_id", "categoria_id", "subcategoria_id", "modo_controle",
  "peso_gramas", "tamanho", "pedras", "preco_venda", "estoque_minimo", "observacao", "indice_preco",
  "valor_aquisicao", "data_aquisicao", "local_estoque", "consignado_com", "ativo",
] as const;

function linhaProduto(d: CamposProduto) {
  return {
    codigo: d.codigo,
    descricao: d.descricao,
    material_id: d.materialId,
    categoria_id: d.categoriaId,
    subcategoria_id: d.subcategoriaId,
    modo_controle: d.modoControle,
    peso_gramas: d.pesoGramas,
    tamanho: d.tamanho,
    pedras: d.pedras,
    preco_venda: d.precoVenda,
    estoque_minimo: d.estoqueMinimo,
    observacao: d.observacao,
    indice_preco: d.indicePreco,
    valor_aquisicao: d.valorAquisicao,
    data_aquisicao: d.dataAquisicao,
    local_estoque: d.localEstoque,
    consignado_com: d.consignadoCom,
  };
}

/**
 * RN-11: material, categoria e subcategoria novos têm de estar ativos. Na
 * edição, o item que o produto já usa continua aceito mesmo se desativado.
 */
async function validarDominios(trx: Trx, d: CamposProduto, atual?: { material_id: string; categoria_id: string; subcategoria_id: string | null }) {
  const material = await trx.selectFrom("app.material").select(["id", "ativo"]).where("id", "=", d.materialId).executeTakeFirst();
  if (!material || (!material.ativo && material.id !== atual?.material_id)) {
    throw new ErroNegocio("Material inexistente ou inativo.");
  }
  const categoria = await trx
    .selectFrom("app.categoria")
    .select(["id", "ativo", "usa_tamanho"])
    .where("id", "=", d.categoriaId)
    .executeTakeFirst();
  if (!categoria || (!categoria.ativo && categoria.id !== atual?.categoria_id)) {
    throw new ErroNegocio("Categoria inexistente ou inativa.");
  }
  if (d.tamanho !== null && !categoria.usa_tamanho) {
    throw new ErroNegocio("Tamanho só é aceito em categoria que usa tamanho.");
  }
  if (d.subcategoriaId) {
    const sub = await trx
      .selectFrom("app.subcategoria")
      .select(["id", "ativo", "categoria_id"])
      .where("id", "=", d.subcategoriaId)
      .executeTakeFirst();
    if (!sub || sub.categoria_id !== d.categoriaId) throw new ErroNegocio("A subcategoria não pertence à categoria.");
    if (!sub.ativo && sub.id !== atual?.subcategoria_id) throw new ErroNegocio("Subcategoria inativa.");
  }
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function comTraducao<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) throw new ErroNegocio("Já existe um produto com este código.");
    throw traduzirErroBanco(erro);
  }
}

/** RN-21B: com saldo inicial, a implantação usa o valor e a data de aquisição. */
export async function criarProduto(bd: Bd, ator: Ator, entrada: unknown): Promise<string> {
  exigirPermissao(ator, "produtos.gerenciar");
  const { produto: d, saldoInicial } = validar(esquemaCriarProduto, entrada);
  if (saldoInicial && d.modoControle === "UNITARIO" && saldoInicial > 1) {
    throw new ErroNegocio("Peça única não pode ter saldo inicial acima de 1.");
  }
  return comTraducao(() =>
    bd.transaction().execute(async (trx) => {
      await validarDominios(trx, d);
      const criado = await trx
        .insertInto("app.produto")
        .values(linhaProduto(d))
        .returning(CAMPOS_AUDITADOS)
        .executeTakeFirstOrThrow();
      if (saldoInicial && saldoInicial > 0) {
        await sql`select app.movimentar_manual(${criado.id}::bigint, 'IMPLANTACAO', ${saldoInicial}::integer,
                    ${d.dataAquisicao ?? hojeSaoPaulo()}::date, null, ${d.valorAquisicao}::numeric, ${ator.id}::bigint)`.execute(trx);
      }
      await registrarAuditoria(trx, {
        usuarioId: ator.id,
        acao: "CRIAR",
        entidade: "produto",
        entidadeId: criado.id,
        depois: { ...criado, saldo_inicial: saldoInicial ?? 0 },
      });
      return criado.id;
    }),
  );
}

/** RN-23: toda alteração vai para a auditoria com antes e depois. */
export async function editarProduto(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "produtos.gerenciar");
  const { id, produto: d } = validar(z.object({ id: esquemaId, produto: esquemaCamposProduto }), entrada);
  await comTraducao(() =>
    bd.transaction().execute(async (trx) => {
      const antes = await trx
        .selectFrom("app.produto")
        .select(CAMPOS_AUDITADOS)
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      if (!antes) throw new ErroNaoEncontrado("Produto não encontrado.");
      await validarDominios(trx, d, antes);
      const depois = await trx
        .updateTable("app.produto")
        .set({ ...linhaProduto(d), atualizado_em: sql<Date>`now()` })
        .where("id", "=", id)
        .returning(CAMPOS_AUDITADOS)
        .executeTakeFirstOrThrow();
      await registrarAuditoria(trx, { usuarioId: ator.id, acao: "ALTERAR", entidade: "produto", entidadeId: id, antes, depois });
    }),
  );
}

/** RN-24: só desativa com saldo zero (garantido também pelo banco). */
export async function definirSituacaoProduto(bd: Bd, ator: Ator, entrada: unknown): Promise<void> {
  exigirPermissao(ator, "produtos.gerenciar");
  const { id, ativo } = validar(z.object({ id: esquemaId, ativo: z.boolean() }), entrada);
  await comTraducao(() =>
    bd.transaction().execute(async (trx) => {
      const antes = await trx.selectFrom("app.produto").select(["id", "ativo"]).where("id", "=", id).forUpdate().executeTakeFirst();
      if (!antes) throw new ErroNaoEncontrado("Produto não encontrado.");
      if (antes.ativo === ativo) throw new ErroNegocio(ativo ? "O produto já está ativo." : "O produto já está inativo.");
      const depois = await trx
        .updateTable("app.produto")
        .set({ ativo, atualizado_em: sql<Date>`now()` })
        .where("id", "=", id)
        .returning(["id", "ativo"])
        .executeTakeFirstOrThrow();
      await registrarAuditoria(trx, {
        usuarioId: ator.id,
        acao: ativo ? "REATIVAR" : "DESATIVAR",
        entidade: "produto",
        entidadeId: id,
        antes,
        depois,
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

const esquemaFiltro = z.object({
  q: z.preprocess(vazioParaNulo, z.string().trim().max(100).nullable()).optional(),
  materialId: idOpcional.optional(),
  categoriaId: idOpcional.optional(),
  situacao: z.preprocess(vazioParaNulo, z.enum(["ativos", "inativos", "todos"]).nullable()).optional(),
  comSaldo: z.preprocess((v) => v === true || v === "1" || v === "on", z.boolean()).optional(),
  local: z.preprocess(vazioParaNulo, z.enum(LOCAIS_ESTOQUE, { error: "Local inválido." }).nullable()).optional(),
});

export interface ProdutoDaLista {
  id: string;
  codigo: string;
  descricao: string;
  materialNome: string;
  categoriaNome: string;
  saldo: number;
  precoVenda: string | null;
  precoSugerido: string | null;
  localEstoque: string | null;
  ativo: boolean;
}

/** Escapa os curingas do LIKE para que o texto digitado seja procurado literalmente. */
function literalLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** RN-25: código pelo início ou descrição por qualquer trecho, com filtros. */
export async function buscarProdutos(
  bd: Bd,
  ator: Ator,
  filtroEntrada: unknown,
): Promise<{ produtos: ProdutoDaLista[]; limiteAtingido: boolean }> {
  exigirPermissao(ator, "produtos.consultar");
  const f = validar(esquemaFiltro, filtroEntrada ?? {});

  let consulta = bd
    .selectFrom("app.produto as p")
    .innerJoin("app.material as m", "m.id", "p.material_id")
    .innerJoin("app.categoria as c", "c.id", "p.categoria_id")
    .leftJoin("app.saldo_estoque as s", "s.produto_id", "p.id")
    .select([
      "p.id",
      "p.codigo",
      "p.descricao",
      "m.nome as materialNome",
      "c.nome as categoriaNome",
      sql<number>`coalesce(s.quantidade, 0)`.as("saldo"),
      "p.preco_venda as precoVenda",
      sql<string | null>`app.preco_sugerido(p.id)`.as("precoSugerido"),
      // Sem saldo, a peça não está em nenhum local: vendida, consignada vendida, perdida.
      sql<string | null>`case when coalesce(s.quantidade, 0) > 0 then p.local_estoque end`.as("localEstoque"),
      "p.ativo",
    ]);

  if (f.q) {
    const termo = literalLike(f.q);
    consulta = consulta.where((eb) =>
      eb.or([
        eb("p.codigo", "like", `${termo.toUpperCase()}%`),
        eb("p.descricao", "ilike", `%${termo}%`),
      ]),
    );
  }
  if (f.materialId) consulta = consulta.where("p.material_id", "=", f.materialId);
  if (f.categoriaId) consulta = consulta.where("p.categoria_id", "=", f.categoriaId);
  const situacao = f.situacao ?? "ativos";
  if (situacao !== "todos") consulta = consulta.where("p.ativo", "=", situacao === "ativos");
  if (f.comSaldo) consulta = consulta.where(sql<boolean>`coalesce(s.quantidade, 0) > 0`);
  // O filtro de local mostra só o que está lá de fato, com saldo.
  if (f.local) consulta = consulta.where("p.local_estoque", "=", f.local).where(sql<boolean>`coalesce(s.quantidade, 0) > 0`);

  const linhas = await consulta.orderBy("p.codigo").limit(LIMITE_BUSCA_PRODUTOS + 1).execute();
  return { produtos: linhas.slice(0, LIMITE_BUSCA_PRODUTOS), limiteAtingido: linhas.length > LIMITE_BUSCA_PRODUTOS };
}

/** RN-68: o que falta para haver preço sugerido; null quando há. */
export async function faltaParaPrecoSugerido(bd: Bd | Trx, produtoId: string): Promise<string | null> {
  const { rows } = await sql<{ ouro: boolean; indice: boolean; preco: boolean; sugerido: string | null }>`
    select lower(m.nome) = 'ouro' as ouro,
           p.indice_preco is not null as indice,
           app.preco_ouro_vigente((now() at time zone 'America/Sao_Paulo')::date) is not null as preco,
           app.preco_sugerido(p.id) as sugerido
      from app.produto p join app.material m on m.id = p.material_id
     where p.id = ${produtoId}
  `.execute(bd);
  const r = rows[0];
  if (!r || r.sugerido !== null) return null;
  if (!r.ouro) return "Preço sugerido só para peças de ouro.";
  const faltas = [!r.indice && "o índice de preço da peça", !r.preco && "o preço do ouro vigente"].filter(Boolean);
  return `Sem preço sugerido: falta ${faltas.join(" e ")}.`;
}

export async function obterProduto(bd: Bd, ator: Ator, idEntrada: unknown) {
  exigirPermissao(ator, "produtos.consultar");
  const id = validar(esquemaId, idEntrada);
  const veCustos = temPermissao(ator.perfil, "custos.ver");

  const p = await bd
    .selectFrom("app.produto as p")
    .innerJoin("app.material as m", "m.id", "p.material_id")
    .innerJoin("app.categoria as c", "c.id", "p.categoria_id")
    .leftJoin("app.subcategoria as sc", "sc.id", "p.subcategoria_id")
    .leftJoin("app.saldo_estoque as s", "s.produto_id", "p.id")
    .selectAll("p")
    .select([
      "m.nome as materialNome",
      "c.nome as categoriaNome",
      "c.usa_tamanho as categoriaUsaTamanho",
      "sc.nome as subcategoriaNome",
      sql<number>`coalesce(s.quantidade, 0)`.as("saldo"),
      sql<string | null>`app.preco_sugerido(p.id)`.as("precoSugerido"),
    ])
    .where("p.id", "=", id)
    .executeTakeFirst();
  if (!p) throw new ErroNaoEncontrado("Produto não encontrado.");

  const [movimentacoes, vendasHistoricas, origem, falta] = await Promise.all([
    bd
      .selectFrom("app.movimentacao_estoque as me")
      .innerJoin("app.tipo_movimentacao as t", "t.codigo", "me.tipo_codigo")
      .innerJoin("app.usuario as u", "u.id", "me.usuario_id")
      .select([
        "me.id",
        "t.descricao as tipo",
        "t.sinal",
        "me.quantidade",
        "me.saldo_apos as saldoApos",
        "me.custo_unitario as custoUnitario",
        "me.data_ocorrencia as dataOcorrencia",
        "me.registrada_em as registradaEm",
        "u.nome as usuarioNome",
        "me.motivo",
      ])
      .where("me.produto_id", "=", id)
      .orderBy("me.id", "desc")
      .execute(),
    bd
      .selectFrom("app.venda_historica")
      .select(["id", "data_venda as dataVenda", "valor_venda as valorVenda", "valor_compra as valorCompra", "simbolico"])
      .where("produto_id", "=", id)
      .orderBy("data_venda", "desc")
      .execute(),
    bd
      .selectFrom("app.produto_origem")
      .select(["aba", "linha", "arquivo", "situacao_original as situacaoOriginal", "local_original as localOriginal", "tamanho_original as tamanhoOriginal"])
      .where("produto_id", "=", id)
      .executeTakeFirst(),
    faltaParaPrecoSugerido(bd, id),
  ]);

  // O que o vendedor não vê sai daqui, no servidor; a tela só mostra o que recebe.
  return {
    produto: {
      ...p,
      valor_aquisicao: veCustos ? p.valor_aquisicao : null,
      data_aquisicao: veCustos ? p.data_aquisicao : null,
      consignado_com: veCustos ? p.consignado_com : null,
    },
    faltaPrecoSugerido: falta,
    movimentacoes: movimentacoes.map((m) => ({ ...m, custoUnitario: veCustos ? m.custoUnitario : null })),
    vendasHistoricas: vendasHistoricas.map((v) => ({ ...v, valorCompra: veCustos ? v.valorCompra : null })),
    origem: origem ? { ...origem, localOriginal: veCustos ? origem.localOriginal : null } : null,
    veCustos,
  };
}
