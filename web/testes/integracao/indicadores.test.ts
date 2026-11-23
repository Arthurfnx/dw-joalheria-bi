// Consultas dos indicadores (RN-110, RN-113), contra o banco de teste, com a
// aplicação conectada como nobreza_aplicacao. Dados de teste inventados pelo
// próprio teste; o histórico da planilha é gravado pelo dono do esquema, como
// faria a importação.

import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroPermissao } from "@/servidor/erros";
import type { Ator } from "@/servidor/permissoes";
import { criarCadastro } from "@/servidor/servicos/cadastros";
import { estoquePor, MESES_VENDAS_POR_MES, vendasPorMes, type VendasPorMes } from "@/servidor/servicos/indicadores";
import { criarProduto } from "@/servidor/servicos/produtos";
import { cancelarVenda, confirmarVenda } from "@/servidor/servicos/vendas";
import {
  conectarComoAplicacao,
  conectarComoDono,
  criarAdministradorDeTeste,
  criarUsuarioPronto,
  nomeUnico,
  recriarBancoDeTeste,
} from "../apoio/banco";

let bd: Bd;
let dono: Bd;
let admin: Ator;
let vendedor: Ator;
let resultado: VendasPorMes;

const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** AAAA-MM do mês `k` meses antes do mês de hoje. */
function mesAntes(k: number): string {
  const [a, m] = hoje.split("-").map(Number);
  const total = a * 12 + (m - 1) - k;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function doMes(mes: string) {
  const linha = resultado.meses.find((m) => m.mes === mes);
  if (!linha) throw new Error(`mês ${mes} ausente`);
  return linha;
}

async function produto(materialId: string, categoriaId: string, saldo: number, extra: Record<string, unknown> = {}) {
  return criarProduto(bd, admin, {
    produto: {
      codigo: nomeUnico("IND-").toUpperCase(),
      descricao: "Peça de teste",
      materialId,
      categoriaId,
      modoControle: "UNITARIO",
      ...extra,
    },
    saldoInicial: saldo,
  });
}

function vender(ator: Ator, dataVenda: string, itens: { produtoId: string; quantidade?: number; precoPraticado: string }[]) {
  return confirmarVenda(bd, ator, {
    chave: randomUUID(),
    dataVenda,
    observacao: "",
    itens: itens.map((i) => ({ quantidade: 1, ...i })),
  });
}

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  dono = conectarComoDono();
  admin = (await criarAdministradorDeTeste(bd)).ator;
  vendedor = (await criarUsuarioPronto(bd, admin, "VENDEDOR")).ator;

  const prata = await criarCadastro(bd, admin, { tipo: "material", nome: "Prata" });
  const ouro = await criarCadastro(bd, admin, { tipo: "material", nome: "Ouro" });
  await criarCadastro(bd, admin, { tipo: "material", nome: "Folheado" });
  const brinco = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Brinco" });
  const colar = await criarCadastro(bd, admin, { tipo: "categoria", nome: "Colar" });

  // Vendas da aplicação no mês corrente: uma com item de preço zero (sem valor) e uma cancelada.
  const vendidoA = await produto(prata, brinco, 1);
  const lote = await produto(prata, brinco, 5, { modoControle: "QUANTIDADE" });
  await vender(vendedor, hoje, [
    { produtoId: vendidoA, precoPraticado: "100,00" },
    { produtoId: lote, quantidade: 3, precoPraticado: "0" },
  ]);
  const devolvido = await produto(prata, brinco, 1);
  const cancelada = await vender(vendedor, hoje, [{ produtoId: devolvido, precoPraticado: "50,00" }]);
  await cancelarVenda(bd, admin, { id: cancelada.id, motivo: "Teste de cancelamento" });

  // Venda lançada com data anterior (I10), dois meses atrás.
  const vendidoB = await produto(ouro, colar, 1);
  await vender(admin, `${mesAntes(2)}-01`, [{ produtoId: vendidoB, precoPraticado: "30,00" }]);

  // Estoque: ativo com saldo, sem saldo e inativo com saldo.
  await produto(ouro, colar, 1);
  await produto(ouro, colar, 0);
  const inativo = await produto(ouro, colar, 1);
  // RN-24 impede desativar com saldo; o gatilho é suspenso aqui só para provar que a consulta
  // também filtra produto inativo, caso algum dia exista um com saldo.
  await dono.transaction().execute(async (trx) => {
    await sql`alter table app.produto disable trigger produto_validar`.execute(trx);
    await sql`update app.produto set ativo = false where id = ${inativo}`.execute(trx);
    await sql`alter table app.produto enable trigger produto_validar`.execute(trx);
  });

  // Histórico da planilha (RN-99): peças já vendidas, com saldo zero.
  const historico = await produto(prata, brinco, 0);
  await dono.transaction().execute(async (trx) => {
    const { rows } = await sql<{ id: string }>`
      insert into app.importacao_lote (arquivo, usuario_id) values ('planilha-de-teste.xlsx', ${admin.id}) returning id`.execute(trx);
    const loteId = rows[0].id;
    const linhas: Array<[string, string | null, boolean]> = [
      [`${mesAntes(1)}-10`, "200.00", false],
      [`${mesAntes(1)}-11`, "0.01", true],
      [`${mesAntes(1)}-12`, null, false],
      [`${mesAntes(0)}-01`, "10.50", false],
      [`${mesAntes(MESES_VENDAS_POR_MES)}-15`, "999.00", false],
    ];
    for (const [data, valor, simbolico] of linhas) {
      await sql`
        insert into app.venda_historica (produto_id, lote_id, data_venda, valor_venda, valor_compra, simbolico)
        values (${historico}, ${loteId}, ${data}::date, ${valor}::numeric, null, ${simbolico})`.execute(trx);
    }
  });

  resultado = await vendasPorMes(bd, vendedor);
});

afterAll(async () => {
  await bd?.destroy();
  await dono?.destroy();
});

describe("Vendas por mês (RN-113)", () => {
  it("RN-113: 24 meses, do mais antigo ao corrente, com meses sem venda como zero", () => {
    expect(resultado.meses).toHaveLength(MESES_VENDAS_POR_MES);
    expect(resultado.meses[0].mes).toBe(mesAntes(MESES_VENDAS_POR_MES - 1));
    expect(resultado.meses.at(-1)!.mes).toBe(mesAntes(0));
    expect(doMes(mesAntes(3))).toEqual({
      mes: mesAntes(3),
      pecasAplicacao: 0,
      pecasPlanilha: 0,
      pecasTotal: 0,
      valorAplicacao: "0.00",
      valorPlanilha: "0.00",
      valorTotal: "0.00",
    });
  });

  it("RN-113: venda cancelada fica fora; item sem valor conta na quantidade e não no valor", () => {
    const corrente = doMes(mesAntes(0));
    expect(corrente.pecasAplicacao).toBe(4);
    expect(corrente.valorAplicacao).toBe("100.00");
  });

  it("RN-113: origem separada por mês e somada no total", () => {
    const corrente = doMes(mesAntes(0));
    expect(corrente.pecasPlanilha).toBe(1);
    expect(corrente.valorPlanilha).toBe("10.50");
    expect(corrente.pecasTotal).toBe(5);
    expect(corrente.valorTotal).toBe("110.50");
    const doisAntes = doMes(mesAntes(2));
    expect(doisAntes).toMatchObject({ pecasAplicacao: 1, pecasPlanilha: 0, valorAplicacao: "30.00", valorTotal: "30.00" });
  });

  it("RN-113: no histórico, venda simbólica e venda sem valor contam na quantidade e ficam fora do valor", () => {
    const anterior = doMes(mesAntes(1));
    expect(anterior.pecasPlanilha).toBe(3);
    expect(anterior.valorPlanilha).toBe("200.00");
    expect(anterior.pecasAplicacao).toBe(0);
  });

  it("RN-113: venda fora dos últimos 24 meses não entra; o total soma o período", () => {
    expect(resultado.total).toEqual({
      pecasAplicacao: 5,
      pecasPlanilha: 4,
      pecasTotal: 9,
      valorAplicacao: "130.00",
      valorPlanilha: "210.50",
      valorTotal: "340.50",
    });
  });

  it("RN-113: o mês de referência pode ser fixado", async () => {
    const r = await vendasPorMes(bd, admin, `${mesAntes(1)}-20`);
    expect(r.meses.at(-1)!.mes).toBe(mesAntes(1));
    expect(r.total.pecasAplicacao).toBe(1);
    // Com a referência um mês antes, a venda de 24 meses atrás passa a entrar no período.
    expect(r.total.pecasPlanilha).toBe(4);
    expect(r.meses[0].pecasPlanilha).toBe(1);
  });
});

describe("Estoque por categoria e por material (RN-110)", () => {
  it("RN-110: só produtos ativos com saldo, em peças, do maior para o menor", async () => {
    const categorias = await estoquePor(bd, vendedor, "categoria");
    // Brinco: 2 do lote + 1 devolvido pelo cancelamento. Colar: 1 ativo com saldo.
    expect(categorias.itens).toEqual([
      { nome: "Brinco", pecas: 3 },
      { nome: "Colar", pecas: 1 },
    ]);
    expect(categorias.totalPecas).toBe(4);
  });

  it("RN-110: material sem peça em estoque não aparece", async () => {
    const materiais = await estoquePor(bd, admin, "material");
    expect(materiais.itens).toEqual([
      { nome: "Prata", pecas: 3 },
      { nome: "Ouro", pecas: 1 },
    ]);
    expect(materiais.totalPecas).toBe(4);
  });

  it("RN-115: nenhuma consulta devolve custo", async () => {
    const chaves = [
      ...Object.keys(resultado.meses[0]),
      ...Object.keys(resultado.total),
      ...Object.keys((await estoquePor(bd, vendedor, "material")).itens[0]),
    ];
    expect(chaves.some((c) => /custo|compra|aquisi/i.test(c))).toBe(false);
  });
});

describe("Permissão (RN-115)", () => {
  it("RN-115: vendedor e administrador consultam; troca de senha pendente bloqueia", async () => {
    await expect(vendasPorMes(bd, admin)).resolves.toBeTruthy();
    await expect(estoquePor(bd, vendedor, "categoria")).resolves.toBeTruthy();
    const pendente: Ator = { ...vendedor, deveTrocarSenha: true };
    await expect(vendasPorMes(bd, pendente)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(estoquePor(bd, pendente, "material")).rejects.toBeInstanceOf(ErroPermissao);
  });
});
