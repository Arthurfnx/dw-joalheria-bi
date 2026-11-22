// Confirmação e cancelamento de venda, contra o
// banco de teste, com a aplicação conectada como nobreza_aplicacao.
// Dados de teste inventados pelo próprio teste.

import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroNegocio, ErroPermissao } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { criarCadastro } from "@/servidor/servicos/cadastros";
import { movimentarEstoque } from "@/servidor/servicos/estoque";
import { registrarPrecoOuro } from "@/servidor/servicos/preco-ouro";
import { buscarProdutos, criarProduto, definirSituacaoProduto } from "@/servidor/servicos/produtos";
import {
  buscarProdutosParaVenda,
  cancelarVenda,
  confirmarVenda,
  listarVendas,
  obterVenda,
  totaisDeVendas,
} from "@/servidor/servicos/vendas";
import {
  conectarComoAplicacao,
  criarAdministradorDeTeste,
  criarUsuarioPronto,
  nomeUnico,
  recriarBancoDeTeste,
} from "../apoio/banco";

let bd: Bd;
let admin: Ator;
let vendedor: Ator;
let prata: string;
let ouro: string;
let brinco: string;

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function novoProduto(extra: Record<string, unknown> = {}, saldo = 1): Promise<{ id: string; codigo: string }> {
  const codigo = nomeUnico("VND-").toUpperCase();
  const id = await criarProduto(bd, admin, {
    produto: { codigo, descricao: "Peça de teste", materialId: prata, categoriaId: brinco, modoControle: "UNITARIO", ...extra },
    saldoInicial: saldo,
  });
  return { id, codigo };
}

async function saldo(id: string): Promise<number> {
  const r = await bd.selectFrom("app.saldo_estoque").select("quantidade").where("produto_id", "=", id).executeTakeFirst();
  return r?.quantidade ?? 0;
}

async function contar(tabela: string): Promise<number> {
  const { rows } = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${tabela}`)}`.execute(bd);
  return rows[0].n;
}

/** RN-30 (I2), depois de cada cenário. */
async function semDivergencia(): Promise<void> {
  expect(await bd.selectFrom("app.divergencia_saldo").selectAll().execute()).toEqual([]);
}

function venda(ator: Ator, itens: { produtoId: string; quantidade?: number; precoPraticado?: string }[], extra: Record<string, unknown> = {}) {
  return confirmarVenda(bd, ator, {
    chave: randomUUID(),
    dataVenda: hoje(),
    observacao: "",
    itens: itens.map((i) => ({ quantidade: 1, precoPraticado: "10,00", ...i })),
    ...extra,
  });
}

function codigo(erro: unknown): string | undefined {
  return (erro as { code?: string }).code;
}

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  admin = (await criarAdministradorDeTeste(bd)).ator;
  vendedor = (await criarUsuarioPronto(bd, admin, "VENDEDOR")).ator;
  prata = await criarCadastro(bd, admin, { tipo: "material", nome: "Prata" });
  ouro = await criarCadastro(bd, admin, { tipo: "material", nome: "Ouro" });
  brinco = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Brinco" });
});

afterAll(async () => {
  await bd?.destroy();
});

describe("Confirmação (RN-40 a RN-44)", () => {
  it("o vendedor registra a venda: número único, saída por item e saldo baixado", async () => {
    const a = await novoProduto();
    const b = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    const v = await venda(vendedor, [{ produtoId: a.id }, { produtoId: b.id, quantidade: 2, precoPraticado: "5" }]);
    expect(v.numero).toMatch(/^\d+$/);
    expect(await saldo(a.id)).toBe(0);
    expect(await saldo(b.id)).toBe(3);
    const saidas = await sql<{ n: number }>`
      select count(*)::int as n from app.movimentacao_estoque m join app.venda_item vi on vi.id = m.venda_item_id
       where vi.venda_id = ${v.id} and m.tipo_codigo = 'SAIDA_VENDA'`.execute(bd);
    expect(saidas.rows[0].n).toBe(2);
    await semDivergencia();
  });

  it("RN-42, I4: um item sem saldo não grava nada e a mensagem identifica o produto", async () => {
    const comSaldo = await novoProduto();
    const semSaldo = await novoProduto({}, 0);
    const antes = { vendas: await contar("venda"), itens: await contar("venda_item"), movs: await contar("movimentacao_estoque") };
    const erro = await venda(admin, [{ produtoId: comSaldo.id }, { produtoId: semSaldo.id }]).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect((erro as Error).message).toContain(semSaldo.codigo);
    expect((erro as Error).message).toMatch(/Saldo insuficiente/);
    expect({ vendas: await contar("venda"), itens: await contar("venda_item"), movs: await contar("movimentacao_estoque") }).toEqual(antes);
    expect(await saldo(comSaldo.id)).toBe(1);
    await semDivergencia();
  });

  it("RN-43, I9: a mesma chave, em sequência ou simultânea, gera uma venda e uma saída por item", async () => {
    const p = await novoProduto({ modoControle: "QUANTIDADE" }, 10);
    const entrada = { chave: randomUUID(), dataVenda: hoje(), observacao: null, itens: [{ produtoId: p.id, quantidade: 2, precoPraticado: "7.50" }] };
    const resultados = await Promise.all([confirmarVenda(bd, vendedor, entrada), confirmarVenda(bd, vendedor, entrada)]);
    const repetida = await confirmarVenda(bd, vendedor, entrada);
    expect(new Set([...resultados, repetida].map((r) => r.id)).size).toBe(1);
    const vendas = await bd.selectFrom("app.venda").select("id").where("chave_idempotencia", "=", entrada.chave).execute();
    expect(vendas).toHaveLength(1);
    const saidas = await bd.selectFrom("app.movimentacao_estoque").select("id").where("produto_id", "=", p.id).where("tipo_codigo", "=", "SAIDA_VENDA").execute();
    expect(saidas).toHaveLength(1);
    expect(await saldo(p.id)).toBe(8);
    await semDivergencia();
  });

  it("RN-31: duas vendas simultâneas da última unidade: uma confirmada e uma recusada", async () => {
    const p = await novoProduto();
    const resultados = await Promise.allSettled([venda(vendedor, [{ produtoId: p.id }]), venda(admin, [{ produtoId: p.id }])]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusada = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(recusada.reason.message)).toContain(p.codigo);
    expect(await saldo(p.id)).toBe(0);
    await semDivergencia();
  });

  it("RN-44, I10: data futura recusada; data anterior aceita", async () => {
    const p = await novoProduto({ modoControle: "QUANTIDADE" }, 3);
    await expect(venda(admin, [{ produtoId: p.id }], { dataVenda: "2999-01-01" })).rejects.toThrow(/futura/);
    const v = await venda(admin, [{ produtoId: p.id }], { dataVenda: "2025-06-15" });
    expect((await obterVenda(bd, admin, v.id)).venda.dataVenda).toBe("2025-06-15");
    // A saída de estoque leva a data da venda como data da ocorrência.
    const mov = await bd.selectFrom("app.movimentacao_estoque").select("data_ocorrencia").where("produto_id", "=", p.id).where("tipo_codigo", "=", "SAIDA_VENDA").executeTakeFirstOrThrow();
    expect(mov.data_ocorrencia).toBe("2025-06-15");
  });

  it("I8: valor do item = quantidade × preço praticado; total = soma dos itens, no banco", async () => {
    const a = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    const b = await novoProduto();
    const v = await venda(admin, [{ produtoId: a.id, quantidade: 3, precoPraticado: "33,33" }, { produtoId: b.id, precoPraticado: "0.01" }]);
    const { venda: cab, itens } = await obterVenda(bd, admin, v.id);
    expect(itens.map((i) => [i.quantidade, i.precoPraticado, i.valorItem])).toEqual([
      [3, "33.33", "99.99"],
      [1, "0.01", "0.01"],
    ]);
    expect(cab.valorTotal).toBe("100.00");
  });

  it("recusa produto repetido, venda sem itens, preço negativo ou com mais de 2 casas, e produto inativo", async () => {
    const p = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    await expect(venda(admin, [{ produtoId: p.id }, { produtoId: p.id }])).rejects.toThrow(/mais de uma vez/);
    await expect(venda(admin, [])).rejects.toThrow(/pelo menos um produto/);
    await expect(venda(admin, [{ produtoId: p.id, precoPraticado: "-1" }])).rejects.toThrow(/Valor inválido/);
    await expect(venda(admin, [{ produtoId: p.id, precoPraticado: "1.005" }])).rejects.toThrow(/Valor inválido/);
    // Direto no banco, sem a validação da camada de servidor.
    const direto = await sql`select app.confirmar_venda(${randomUUID()}::uuid, ${admin.id}::bigint, current_date, null,
      ${JSON.stringify([{ produto_id: p.id, quantidade: 1, preco_praticado: 1.005 }])}::jsonb)`.execute(bd).catch((e: unknown) => e);
    expect(codigo(direto)).toBe("NJ006");
    const inativo = await novoProduto({}, 0);
    await definirSituacaoProduto(bd, admin, { id: inativo.id, ativo: false });
    const erro = await venda(admin, [{ produtoId: inativo.id }]).catch((e: unknown) => e);
    expect((erro as Error).message).toContain(inativo.codigo);
  });

  it("E1: nobreza_aplicacao não grava venda nem item diretamente", async () => {
    const tentativas = [
      sql`insert into app.venda (chave_idempotencia, data_venda, vendedor_id, valor_total) values (${randomUUID()}, current_date, ${admin.id}, 0)`,
      sql`update app.venda set valor_total = 0`,
      sql`delete from app.venda_item`,
    ];
    for (const t of tentativas) expect(codigo(await t.execute(bd).catch((e: unknown) => e))).toBe("42501");
  });
});

describe("Critério 6: cancelamento (RN-45, RN-46, I5)", () => {
  it("devolve o saldo, preserva as movimentações originais e liga o estorno à saída", async () => {
    const a = await novoProduto();
    const b = await novoProduto({ modoControle: "QUANTIDADE" }, 4);
    const v = await venda(vendedor, [{ produtoId: a.id }, { produtoId: b.id, quantidade: 3 }]);
    const originais = await bd.selectFrom("app.movimentacao_estoque").selectAll().where("produto_id", "in", [a.id, b.id]).orderBy("id").execute();

    await cancelarVenda(bd, admin, { id: v.id, motivo: "Cliente desistiu" });

    expect(await saldo(a.id)).toBe(1);
    expect(await saldo(b.id)).toBe(4);
    const depois = await bd.selectFrom("app.movimentacao_estoque").selectAll().where("produto_id", "in", [a.id, b.id]).orderBy("id").execute();
    expect(depois.slice(0, originais.length)).toEqual(originais);
    const estornos = depois.slice(originais.length);
    expect(estornos.map((e) => e.tipo_codigo)).toEqual(["ESTORNO_VENDA", "ESTORNO_VENDA"]);
    const saidas = originais.filter((m) => m.tipo_codigo === "SAIDA_VENDA").map((m) => m.id).sort();
    expect(estornos.map((e) => e.estorna_id).sort()).toEqual(saidas);
    expect(estornos.every((e) => e.motivo === "Cliente desistiu")).toBe(true);

    const { venda: cab } = await obterVenda(bd, admin, v.id);
    expect(cab).toMatchObject({ situacao: "CANCELADA", motivoCancelamento: "Cliente desistiu", canceladaPor: admin.nome });
    await semDivergencia();
  });

  it("não pode ser repetido", async () => {
    const p = await novoProduto();
    const v = await venda(admin, [{ produtoId: p.id }]);
    await cancelarVenda(bd, admin, { id: v.id, motivo: "x" });
    await expect(cancelarVenda(bd, admin, { id: v.id, motivo: "x" })).rejects.toThrow(/já está cancelada/);
    expect(await saldo(p.id)).toBe(1);
  });

  it("é negado ao vendedor, inclusive chamando a operação do banco diretamente", async () => {
    const p = await novoProduto();
    const v = await venda(vendedor, [{ produtoId: p.id }]);
    await expect(cancelarVenda(bd, vendedor, { id: v.id, motivo: "x" })).rejects.toBeInstanceOf(ErroPermissao);
    const erro = await sql`select app.cancelar_venda(${v.id}::bigint, ${vendedor.id}::bigint, 'x')`.execute(bd).catch((e: unknown) => e);
    expect(codigo(erro)).toBe("NJ004");
    expect((await obterVenda(bd, admin, v.id)).venda.situacao).toBe("CONFIRMADA");
  });

  it("exige motivo", async () => {
    const p = await novoProduto();
    const v = await venda(admin, [{ produtoId: p.id }]);
    await expect(cancelarVenda(bd, admin, { id: v.id, motivo: "  " })).rejects.toThrow(/motivo/);
  });

  it("RN-46: peça única que já voltou ao estoque por outro caminho faz o cancelamento inteiro falhar", async () => {
    const unica = await novoProduto();
    const outra = await novoProduto({ modoControle: "QUANTIDADE" }, 2);
    const v = await venda(admin, [{ produtoId: unica.id }, { produtoId: outra.id }]);
    await movimentarEstoque(bd, admin, { produtoId: unica.id, tipo: "AJUSTE_POSITIVO", quantidade: 1, dataOcorrencia: hoje(), motivo: "Achada" });
    const erro = await cancelarVenda(bd, admin, { id: v.id, motivo: "x" }).catch((e: unknown) => e);
    expect((erro as Error).message).toContain(unica.codigo);
    expect((await obterVenda(bd, admin, v.id)).venda.situacao).toBe("CONFIRMADA");
    // Nada do cancelamento ficou: o outro item continua baixado.
    expect(await saldo(outra.id)).toBe(1);
    await semDivergencia();
  });
});

describe("Critério 8: peça consignada", () => {
  it("pode ser vendida e depois não aparece mais como disponível no local", async () => {
    const p = await novoProduto({ localEstoque: "Consignado", consignadoCom: "Pessoa de Teste" });
    const antes = await buscarProdutos(bd, admin, { q: p.codigo, local: "Consignado" });
    expect(antes.produtos.map((x) => x.id)).toEqual([p.id]);
    await venda(vendedor, [{ produtoId: p.id }]);
    expect(await saldo(p.id)).toBe(0);
    expect((await buscarProdutos(bd, admin, { q: p.codigo, local: "Consignado" })).produtos).toEqual([]);
    const lista = await buscarProdutos(bd, admin, { q: p.codigo });
    expect(lista.produtos[0].localEstoque).toBeNull();
    expect(await buscarProdutosParaVenda(bd, vendedor, p.codigo)).toEqual([]);
  });
});

describe("Critério 10 (RN-69): preço sugerido como preço de tabela", () => {
  it("peça de ouro sem preço de venda entra com o sugerido, e o praticado pode ser outro", async () => {
    await registrarPrecoOuro(bd, admin, { valorGrama: "300", vigenteDesde: "2026-01-01" });
    const p = await novoProduto({ materialId: ouro, indicePreco: "2" });
    const busca = await buscarProdutosParaVenda(bd, vendedor, p.codigo);
    expect(busca[0].precoTabela).toBe("960.00");
    const v = await venda(vendedor, [{ produtoId: p.id, precoPraticado: "900" }]);
    const { itens } = await obterVenda(bd, vendedor, v.id);
    expect(itens[0]).toMatchObject({ precoTabela: "960.00", precoPraticado: "900.00", valorItem: "900.00" });
  });

  it("com preço de venda cadastrado, ele é o preço de tabela; sem nenhum, a tabela fica vazia", async () => {
    const comPreco = await novoProduto({ materialId: ouro, indicePreco: "2", precoVenda: "1.234,50" });
    expect((await buscarProdutosParaVenda(bd, vendedor, comPreco.codigo))[0].precoTabela).toBe("1234.50");
    const semNada = await novoProduto();
    expect((await buscarProdutosParaVenda(bd, vendedor, semNada.codigo))[0].precoTabela).toBeNull();
    const v = await venda(vendedor, [{ produtoId: semNada.id, precoPraticado: "15" }]);
    expect((await obterVenda(bd, admin, v.id)).itens[0].precoTabela).toBeNull();
  });
});

describe("Consulta e totais (RN-47, RN-64)", () => {
  it("lista por período com número, vendedor, itens, total e situação", async () => {
    const p = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    const v = await venda(vendedor, [{ produtoId: p.id, quantidade: 2, precoPraticado: "12" }]);
    const { vendas } = await listarVendas(bd, vendedor, { de: hoje(), ate: hoje() });
    expect(vendas.find((x) => x.id === v.id)).toMatchObject({ numero: v.numero, vendedorNome: vendedor.nome, quantidadeItens: 2, valorTotal: "24.00", situacao: "CONFIRMADA" });
    expect((await listarVendas(bd, admin, { de: "2000-01-01", ate: "2000-01-31" })).vendas).toEqual([]);
    await expect(listarVendas(bd, admin, { de: hoje(), ate: "2000-01-01" })).rejects.toThrow(/anterior/);
  });

  it("totais do dia e do mês só com vendas confirmadas da aplicação", async () => {
    const antes = await totaisDeVendas(bd, vendedor);
    const p = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    await venda(vendedor, [{ produtoId: p.id, precoPraticado: "100" }]);
    const cancelada = await venda(vendedor, [{ produtoId: p.id, precoPraticado: "50" }]);
    await cancelarVenda(bd, admin, { id: cancelada.id, motivo: "x" });
    const depois = await totaisDeVendas(bd, vendedor);
    expect(depois.dia.quantidade - antes.dia.quantidade).toBe(1);
    expect(depois.mes.quantidade - antes.mes.quantidade).toBe(1);
    // Diferença de 100,00 comparando centavos inteiros.
    const centavos = (v: string) => Number(v.replace(".", ""));
    expect(centavos(depois.dia.valor) - centavos(antes.dia.valor)).toBe(10000);
  });
});
