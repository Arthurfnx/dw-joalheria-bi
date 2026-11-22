// T02 — critérios 2, 3, 7, 10 (servidor), 11 e 12: invariantes de estoque,
// concorrência, papel de leitura do DW, tamanho só em anéis e preço do ouro.
// Dados de teste inventados pelo próprio teste.

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroNegocio, ErroPermissao } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { criarCadastro, definirUsaTamanho } from "@/servidor/servicos/cadastros";
import { movimentarEstoque } from "@/servidor/servicos/estoque";
import { listarPrecosOuro, precoOuroVigente, registrarPrecoOuro } from "@/servidor/servicos/preco-ouro";
import {
  buscarProdutos,
  criarProduto,
  definirSituacaoProduto,
  editarProduto,
  obterProduto,
} from "@/servidor/servicos/produtos";
import { alterarConfiguracao } from "@/servidor/servicos/configuracoes";
import {
  conectarComoAplicacao,
  conectarComoDono,
  conectarComoLeituraDw,
  criarAdministradorDeTeste,
  criarUsuarioPronto,
  nomeUnico,
  recriarBancoDeTeste,
} from "../apoio/banco";

let bd: Bd;
let dono: Bd;
let admin: Ator;
let vendedor: Ator;
let ouro: string;
let prata: string;
let anel: string;
let brinco: string;

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function camposProduto(extra: Record<string, unknown> = {}) {
  return {
    codigo: nomeUnico("TST-"),
    descricao: "Peça de teste",
    materialId: prata,
    categoriaId: brinco,
    modoControle: "UNITARIO",
    ...extra,
  };
}

async function novoProduto(extra: Record<string, unknown> = {}, saldoInicial: number | null = null): Promise<string> {
  return criarProduto(bd, admin, { produto: camposProduto(extra), saldoInicial });
}

async function saldo(id: string): Promise<number> {
  const r = await bd.selectFrom("app.saldo_estoque").select("quantidade").where("produto_id", "=", id).executeTakeFirst();
  return r?.quantidade ?? 0;
}

/** RN-30 (I2): roda depois de cada cenário. */
async function semDivergencia(): Promise<void> {
  const divergentes = await bd.selectFrom("app.divergencia_saldo").selectAll().execute();
  expect(divergentes).toEqual([]);
}

function codigo(erro: unknown): string | undefined {
  return (erro as { code?: string }).code;
}

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  dono = conectarComoDono();
  admin = (await criarAdministradorDeTeste(bd)).ator;
  vendedor = (await criarUsuarioPronto(bd, admin, "VENDEDOR")).ator;
  ouro = await criarCadastro(bd, admin, { tipo: "material", nome: "Ouro" });
  prata = await criarCadastro(bd, admin, { tipo: "material", nome: "Prata" });
  anel = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Anel", usaTamanho: true });
  brinco = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Brinco" });
});

afterAll(async () => {
  await bd?.destroy();
  await dono?.destroy();
});

describe("Invariantes de estoque (I1, I2, I3, I6, I7)", () => {
  it("RN-21B: saldo inicial no cadastro vira implantação com o valor e a data de aquisição", async () => {
    const id = await novoProduto({ valorAquisicao: "120,50", dataAquisicao: "2026-01-15" }, 1);
    expect(await saldo(id)).toBe(1);
    const mov = await bd.selectFrom("app.movimentacao_estoque").selectAll().where("produto_id", "=", id).execute();
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ tipo_codigo: "IMPLANTACAO", quantidade: 1, custo_unitario: "120.50", data_ocorrencia: "2026-01-15" });
    await semDivergencia();
  });

  it("I1 e RN-31: nenhuma saída deixa o saldo negativo", async () => {
    const id = await novoProduto({}, 1);
    await movimentarEstoque(bd, admin, { produtoId: id, tipo: "SAIDA_PERDA", quantidade: 1, dataOcorrencia: hoje(), motivo: "teste" });
    await expect(
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "SAIDA_PERDA", quantidade: 1, dataOcorrencia: hoje(), motivo: "teste" }),
    ).rejects.toThrow(/Saldo insuficiente/);
    expect(await saldo(id)).toBe(0);
    await semDivergencia();
  });

  it("I3 e RN-32: peça única nunca passa de saldo 1", async () => {
    const id = await novoProduto({}, 1);
    await expect(
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "AJUSTE_POSITIVO", quantidade: 1, dataOcorrencia: hoje(), motivo: "teste" }),
    ).rejects.toThrow(/Peça única/);
    await expect(novoProduto({}, 2)).rejects.toThrow(/Peça única/);
    await semDivergencia();
  });

  it("RN-33: a implantação é feita uma única vez", async () => {
    const id = await novoProduto({ modoControle: "QUANTIDADE" }, 3);
    const erro = await sql`select app.movimentar_manual(${id}::bigint, 'IMPLANTACAO', 1, current_date, null, null, ${admin.id}::bigint)`
      .execute(bd)
      .catch((e: unknown) => e);
    expect(codigo(erro)).toBe("NJ007");
    await semDivergencia();
  });

  it("RN-34 e RN-35: saída e ajuste exigem motivo e data não futura; I7: nenhuma venda é criada", async () => {
    const id = await novoProduto({ modoControle: "QUANTIDADE" }, 5);
    await expect(
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "SAIDA_PRESENTE", quantidade: 1, dataOcorrencia: hoje(), motivo: " " }),
    ).rejects.toThrow(/motivo/);
    await expect(
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "AJUSTE_NEGATIVO", quantidade: 1, dataOcorrencia: "2999-01-01", motivo: "x" }),
    ).rejects.toThrow(/futura/);
    for (const tipo of ["SAIDA_PRESENTE", "SAIDA_PERDA", "SAIDA_ROUBO", "AJUSTE_NEGATIVO"]) {
      await movimentarEstoque(bd, admin, { produtoId: id, tipo, quantidade: 1, dataOcorrencia: hoje(), motivo: "teste" });
    }
    await movimentarEstoque(bd, admin, { produtoId: id, tipo: "AJUSTE_POSITIVO", quantidade: 2, dataOcorrencia: hoje(), motivo: "teste" });
    expect(await saldo(id)).toBe(3);
    const vendas = await bd.selectFrom("app.venda_historica").select("id").where("produto_id", "=", id).execute();
    const { rows } = await sql<{ n: number }>`select count(*)::int as n from app.venda`.execute(bd);
    expect(vendas).toHaveLength(0);
    expect(rows[0].n).toBe(0);
    const historico = await obterProduto(bd, admin, id);
    // RN-37: da mais recente para a mais antiga, com o saldo após cada uma.
    expect(historico.movimentacoes.map((m) => m.saldoApos)).toEqual([3, 1, 2, 3, 4, 5]);
    await semDivergencia();
  });

  it("o vendedor não movimenta estoque, nem pela função do banco", async () => {
    const id = await novoProduto({}, 1);
    await expect(
      movimentarEstoque(bd, vendedor, { produtoId: id, tipo: "SAIDA_PERDA", quantidade: 1, dataOcorrencia: hoje(), motivo: "x" }),
    ).rejects.toBeInstanceOf(ErroPermissao);
    const erro = await sql`select app.movimentar_manual(${id}::bigint, 'SAIDA_PERDA', 1, current_date, 'x', null, ${vendedor.id}::bigint)`
      .execute(bd)
      .catch((e: unknown) => e);
    expect(codigo(erro)).toBe("NJ004");
  });

  it("I6 e E1: nobreza_aplicacao não grava direto em movimentação, saldo e venda, nem chama a função interna", async () => {
    const id = await novoProduto({}, 1);
    const tentativas = [
      sql`insert into app.movimentacao_estoque (produto_id, tipo_codigo, quantidade, saldo_apos, data_ocorrencia, usuario_id)
          values (${id}, 'AJUSTE_POSITIVO', 1, 2, current_date, ${admin.id})`,
      sql`insert into app.saldo_estoque (produto_id, quantidade) values (${id}, 5)`,
      sql`update app.saldo_estoque set quantidade = 5 where produto_id = ${id}`,
      sql`delete from app.movimentacao_estoque where produto_id = ${id}`,
      sql`insert into app.venda (chave_idempotencia, data_venda, vendedor_id, valor_total)
          values (gen_random_uuid(), current_date, ${admin.id}, 0)`,
      sql`select app._movimentar(${id}::bigint, 'AJUSTE_POSITIVO', 1, current_date, 'x', null, ${admin.id}::bigint)`,
    ];
    for (const t of tentativas) {
      const erro = await t.execute(bd).catch((e: unknown) => e);
      expect(codigo(erro)).toBe("42501");
    }
    expect(await saldo(id)).toBe(1);
  });

  it("I6: movimentação não é alterada nem apagada, nem pelo dono do esquema", async () => {
    const id = await novoProduto({}, 1);
    await expect(sql`update app.movimentacao_estoque set quantidade = 2 where produto_id = ${id}`.execute(dono)).rejects.toThrow(/imutável/);
    await expect(sql`delete from app.movimentacao_estoque where produto_id = ${id}`.execute(dono)).rejects.toThrow(/imutável/);
  });

  it("RN-31: duas saídas simultâneas da última unidade resultam em uma aceita e uma recusada", async () => {
    const id = await novoProduto({}, 1);
    const saida = () =>
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "SAIDA_ROUBO", quantidade: 1, dataOcorrencia: hoje(), motivo: "teste" });
    const resultados = await Promise.allSettled([saida(), saida()]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusada = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusada.reason).toBeInstanceOf(ErroNegocio);
    expect(String(recusada.reason.message)).toMatch(/Saldo insuficiente/);
    expect(await saldo(id)).toBe(0);
    await semDivergencia();
  });
});

describe("Produtos", () => {
  it("RN-20: o código é gravado em maiúsculas e é único", async () => {
    const id = await novoProduto({ codigo: "  abc-1 " });
    const p = await obterProduto(bd, admin, id);
    expect(p.produto.codigo).toBe("ABC-1");
    await expect(novoProduto({ codigo: "ABC-1" })).rejects.toThrow(/Já existe um produto com este código/);
  });

  it("RN-20 e RN-22: código e modo não mudam depois da primeira movimentação", async () => {
    const id = await novoProduto({}, 1);
    const atual = await obterProduto(bd, admin, id);
    await expect(
      editarProduto(bd, admin, { id, produto: camposProduto({ codigo: "OUTRO-COD", descricao: atual.produto.descricao }) }),
    ).rejects.toThrow(/não mudam/);
  });

  it("RN-24: desativar produto com saldo é recusado com mensagem clara; com saldo zero é aceito", async () => {
    const id = await novoProduto({}, 1);
    await expect(definirSituacaoProduto(bd, admin, { id, ativo: false })).rejects.toThrow(/saldo zero/);
    await movimentarEstoque(bd, admin, { produtoId: id, tipo: "SAIDA_PERDA", quantidade: 1, dataOcorrencia: hoje(), motivo: "x" });
    await definirSituacaoProduto(bd, admin, { id, ativo: false });
    // Produto inativo não é movimentado.
    await expect(
      movimentarEstoque(bd, admin, { produtoId: id, tipo: "AJUSTE_POSITIVO", quantidade: 1, dataOcorrencia: hoje(), motivo: "x" }),
    ).rejects.toThrow(/inativo/);
  });

  it("RN-23: a edição grava antes e depois na auditoria", async () => {
    const id = await novoProduto({ descricao: "Antes" });
    await editarProduto(bd, admin, { id, produto: camposProduto({ codigo: (await obterProduto(bd, admin, id)).produto.codigo, descricao: "Depois" }) });
    const aud = await bd
      .selectFrom("app.auditoria")
      .select(["dados_antes", "dados_depois"])
      .where("entidade", "=", "produto")
      .where("entidade_id", "=", id)
      .where("acao", "=", "ALTERAR")
      .executeTakeFirstOrThrow();
    expect(aud).toMatchObject({ dados_antes: { descricao: "Antes" }, dados_depois: { descricao: "Depois" } });
  });

  it("RN-21: data de aquisição futura é recusada", async () => {
    await expect(novoProduto({ dataAquisicao: "2999-12-31" })).rejects.toThrow(/futura/);
  });

  it("RN-25: busca por início do código, trecho da descrição, saldo e local", async () => {
    const prefixo = nomeUnico("BUSCA").toUpperCase();
    await novoProduto({ codigo: `${prefixo}-1`, descricao: "Brinco argola dourada" }, 1);
    await novoProduto({ codigo: `${prefixo}-2`, descricao: "Brinco liso", localEstoque: "Consignado", consignadoCom: "Pessoa de Teste" }, 1);
    await novoProduto({ codigo: `${prefixo}-3`, descricao: "Brinco sem saldo" });
    expect((await buscarProdutos(bd, vendedor, { q: prefixo.toLowerCase() })).produtos).toHaveLength(3);
    expect((await buscarProdutos(bd, vendedor, { q: "argola dour" })).produtos.map((p) => p.codigo)).toEqual([`${prefixo}-1`]);
    expect((await buscarProdutos(bd, vendedor, { q: prefixo, comSaldo: "1" })).produtos).toHaveLength(2);
    expect((await buscarProdutos(bd, vendedor, { q: prefixo, local: "Consignado" })).produtos.map((p) => p.codigo)).toEqual([`${prefixo}-2`]);
    // Curinga digitado é procurado literalmente.
    expect((await buscarProdutos(bd, vendedor, { q: "%" })).produtos).toHaveLength(0);
  });

  it("critério 10: o vendedor não vê valor de aquisição, custo nem consignado_com", async () => {
    const id = await novoProduto(
      { valorAquisicao: "99.90", dataAquisicao: "2026-01-02", localEstoque: "Consignado", consignadoCom: "Pessoa de Teste" },
      1,
    );
    const visto = await obterProduto(bd, vendedor, id);
    expect(visto.produto.valor_aquisicao).toBeNull();
    expect(visto.produto.data_aquisicao).toBeNull();
    expect(visto.produto.consignado_com).toBeNull();
    expect(visto.movimentacoes.every((m) => m.custoUnitario === null)).toBe(true);
    expect(JSON.stringify(visto)).not.toContain("Pessoa de Teste");
    expect(JSON.stringify(visto)).not.toContain("99.9");
    const doAdmin = await obterProduto(bd, admin, id);
    expect(doAdmin.produto.consignado_com).toBe("Pessoa de Teste");
    await expect(novoProduto.call(null, {})).resolves.toBeTruthy();
    await expect(criarProduto(bd, vendedor, { produto: camposProduto(), saldoInicial: null })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("consignado exige o nome, e o nome só com local Consignado", async () => {
    await expect(novoProduto({ localEstoque: "Consignado" })).rejects.toThrow(/consignada/);
    await expect(novoProduto({ localEstoque: "Estoque", consignadoCom: "Alguém" })).rejects.toThrow(/consignada/);
  });
});

describe("RN-21A: tamanho só em categoria que usa tamanho", () => {
  it("aceita tamanho em anel e recusa em brinco, pelo serviço", async () => {
    await expect(novoProduto({ categoriaId: anel, tamanho: "16" })).resolves.toBeTruthy();
    await expect(novoProduto({ categoriaId: brinco, tamanho: "16" })).rejects.toThrow(/Tamanho só é aceito/);
  });

  it("o banco recusa tamanho em categoria sem tamanho mesmo por chamada direta", async () => {
    const erro = await bd
      .insertInto("app.produto")
      .values({ codigo: nomeUnico("DIR-").toUpperCase(), descricao: "x", material_id: prata, categoria_id: brinco, modo_controle: "UNITARIO", tamanho: "16" })
      .execute()
      .catch((e: unknown) => e);
    expect(codigo(erro)).toBe("NJ006");
  });

  it("não desliga o tamanho de uma categoria que tem produtos com tamanho", async () => {
    await expect(definirUsaTamanho(bd, admin, { id: anel, usaTamanho: false })).rejects.toThrow(/tamanho preenchido/);
  });
});

describe("RN-66 a RN-68: preço do ouro e preço sugerido", () => {
  it("sem preço do ouro vigente não há sugestão, e a tela diz o que falta", async () => {
    const id = await novoProduto({ materialId: ouro, indicePreco: "2.5" });
    const p = await obterProduto(bd, admin, id);
    expect(p.produto.precoSugerido).toBeNull();
    expect(p.faltaPrecoSugerido).toMatch(/preço do ouro vigente/);
  });

  it("registro imutável, vigência pela data e fórmula preço × fator × índice em centavos", async () => {
    await registrarPrecoOuro(bd, admin, { valorGrama: "300,00", vigenteDesde: "2026-01-01" });
    await registrarPrecoOuro(bd, admin, { valorGrama: "333.33", vigenteDesde: "2026-03-01" });
    // Vigência futura não vale hoje... a não ser que a data já tenha chegado.
    await registrarPrecoOuro(bd, admin, { valorGrama: "999", vigenteDesde: "2999-01-01" });

    expect(await precoOuroVigente(bd, "2026-02-15")).toBe("300.00");
    expect(await precoOuroVigente(bd, "2026-03-01")).toBe("333.33");
    expect(await precoOuroVigente(bd, "2025-12-31")).toBeNull();

    const comIndice = await novoProduto({ materialId: ouro, indicePreco: "1.3333" });
    const { rows } = await sql<{ v: string }>`select app.preco_sugerido(${comIndice}::bigint) as v`.execute(bd);
    // 333,33 × 1,6 × 1,3333 = 711,0862... → 711,09
    expect(rows[0].v).toBe("711.09");

    const semIndice = await novoProduto({ materialId: ouro });
    expect((await obterProduto(bd, admin, semIndice)).faltaPrecoSugerido).toMatch(/índice de preço/);
    const deprata = await novoProduto({ materialId: prata, indicePreco: "2" });
    expect((await obterProduto(bd, admin, deprata)).produto.precoSugerido).toBeNull();
    expect((await obterProduto(bd, admin, deprata)).faltaPrecoSugerido).toMatch(/só para peças de ouro/);

    // O fator vem da configuração.
    await alterarConfiguracao(bd, admin, { chave: "fator_preco_ouro", valor: "2" });
    const { rows: r2 } = await sql<{ v: string }>`select app.preco_sugerido(${comIndice}::bigint) as v`.execute(bd);
    // 333,33 × 2 × 1,3333 = 888,8578... → 888,86
    expect(r2[0].v).toBe("888.86");

    await expect(sql`update app.preco_ouro set valor_grama = 1`.execute(dono)).rejects.toThrow(/imutável/);
    await expect(sql`delete from app.preco_ouro`.execute(dono)).rejects.toThrow(/imutável/);
    const erro = await sql`update app.preco_ouro set valor_grama = 1`.execute(bd).catch((e: unknown) => e);
    expect(codigo(erro)).toBe("42501");

    const historico = await listarPrecosOuro(bd, admin);
    expect(historico.map((h) => h.valorGrama)).toEqual(["999.00", "333.33", "300.00"]);
    await expect(listarPrecosOuro(bd, vendedor)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(registrarPrecoOuro(bd, admin, { valorGrama: "0", vigenteDesde: "2026-01-01" })).rejects.toThrow();
  });
});

describe("Critério 7: papel nobreza_leitura_dw", () => {
  let leitura: Bd;
  beforeAll(() => {
    leitura = conectarComoLeituraDw();
  });
  afterAll(async () => {
    await leitura?.destroy();
  });

  it("lê produtos sem consignado_com e calcula o preço sugerido", async () => {
    const linhas = await sql`select id, codigo, local_estoque, app.preco_sugerido(id) from app.produto limit 1`.execute(leitura);
    expect(linhas.rows.length).toBe(1);
  });

  it.each([
    ["consignado_com", sql`select consignado_com from app.produto`],
    ["select * de produto", sql`select * from app.produto`],
    ["local_original", sql`select local_original from app.produto_origem`],
    ["usuario", sql`select id from app.usuario`],
    ["sessao", sql`select 1 from app.sessao`],
    ["auditoria", sql`select 1 from app.auditoria`],
  ])("SELECT em %s é recusado", async (_nome, consulta) => {
    const erro = await consulta.execute(leitura).catch((e: unknown) => e);
    expect(codigo(erro)).toBe("42501");
  });

  it("não escreve em nada", async () => {
    const erro = await sql`update app.produto set descricao = 'x'`.execute(leitura).catch((e: unknown) => e);
    expect(codigo(erro)).toBe("42501");
  });
});
