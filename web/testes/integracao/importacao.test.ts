// T02 — critérios 4, 5, 6 e 8: importação com planilhas de teste geradas aqui.
// Todas as linhas são inventadas; a planilha real nunca entra nos testes.

import ExcelJS from "exceljs";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bd } from "@/servidor/bd/conexao";
import { ErroNegocio } from "@/servidor/erros";
import { lerCls, lerFolheados, lerRamon, type LinhaImportacao } from "@/servidor/importacao/leitura";
import type { Ator } from "@/servidor/permissoes";
import { importarPlanilhas, listarOcorrencias, type ResultadoImportacao } from "@/servidor/servicos/importacao";
import { conectarComoAplicacao, criarAdministradorDeTeste, criarUsuarioPronto, recriarBancoDeTeste } from "../apoio/banco";

// Nome de pessoa inventado para o local de consignação: não pode aparecer em
// ocorrências, contagens nem no resumo do comando (RN-104).
const PESSOA = "Fulana Consignataria Teste";
const DESCRICAO_SENSIVEL = "Brinco descricao que nao pode vazar";

type LinhaFolheados = [string, string, number | null, number | null, string | number | null, number | null, string | null, Date | null, number | null, Date | number | null];

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Colunas: código, descrição, valor de compra, peso, tamanho, índice, local, data da compra, valor de venda, data da venda.
const FOLHEADOS: LinhaFolheados[] = [
  ["1-0001", "ANEL teste com tamanho", 100, 2.5, "T16", 200, "ESTOQUE", d("2025-01-02"), null, null], // 3
  ["4-0002", "BRINCO teste armario", 50, null, null, 100, "ARMARIO", null, null, null], // 4
  ["4-0003", "BINCO teste maleta 1", 50, null, null, 100, "MALETA 1", null, null, null], // 5
  ["4-0004", "BRNCO teste maleta 2", 50, null, null, 100, "2 MALETA", null, null, null], // 6
  ["4-0005", "BRINCO teste novo", 50, null, null, 100, "novo", null, null, null], // 7
  ["4-0006", DESCRICAO_SENSIVEL, 60, null, null, 120, PESSOA, null, null, null], // 8
  ["4-0007", "PULSEIRA teste vendida", 70, null, null, 140, "VENDIDO", null, 150, d("2026-01-10")], // 9
  ["4-0008", "PULSEIRA venda local divergente", 70, null, null, 140, "ESTOQUE", null, 0.01, d("2026-02-01")], // 10
  ["4-0009", "PULSEIRA teste sumiu", 70, null, null, 140, "sumiu", null, null, null], // 11
  ["4-0010", "PULSEIRA teste sem local", 70, null, null, 140, null, null, null, null], // 12
  ["4-0011", "PULSEIRA teste data invalida", 70, null, null, 140, "VENDIDO", null, 90, 1], // 13
  ["Serviço", "BRINCO conserto", 10, null, null, null, null, null, null, null], // 14
  ["4-0012", "BRINCO repetido um", 50, null, null, 100, "ESTOQUE", null, null, null], // 15
  ["4-0012", "BRINCO repetido dois", 50, null, null, 100, "ESTOQUE", null, null, null], // 16
  ["X-ABC", "BRINCO padrao estranho", 50, null, null, 100, "ESTOQUE", null, null, null], // 17
  ["R0700001", "ANEL de prata", 80, null, 18, 160, "ESTOQUE", null, null, null], // 18
  ["4-0013", "TRIO sem categoria conhecida", 50, null, null, 100, "ESTOQUE", null, null, null], // 19
  ["4-0014", "BRINCO com tamanho indevido", 50, null, "T 18", 100, "ESTOQUE", null, null, null], // 20
  ["4-0015", "PULSEIRA vendida sem data", 70, null, null, 140, "VENDIDO", null, null, null], // 21
  ["8-0001", "PINGENTE codigo igual ao CLS", 50, null, null, 100, "ESTOQUE", null, null, null], // 22
  ["13-0001", "ALIANÇA de teste", 90, null, "T 20", 180, "ESTOQUE", null, null, null], // 23
];

// Colunas: código, descrição, valor de compra, valor de venda, índice de venda, data da venda, tamanho, cliente, valor vendido.
const RAMON: (string | number | Date | null)[][] = [
  ["R0700001", "ANEL de prata", 80, 200, null, null, null, null, null], // 3: já existe em FOLHEADOS
  ["R0700002", "BRINCO prata so no ramon", 40, 100, null, null, null, null, null], // 4: novo, sem local
  ["Serviço", "SOLDA", 15, null, null, null, null, null, null], // 5
];

// Colunas: código, categoria, descrição, peso, Ø, Ind Preço.
const CLS: (string | number | null)[][] = [
  ["0001", "anel", "anel de ouro teste", 1.5, 17, 1.3333], // 2: Ø em anel
  ["0002", "Brinco", "brinco de ouro teste", 0.8, 5, 2], // 3: Ø em categoria sem tamanho
  ["0003", "brinco", "brinco de ouro minusculo", 0.7, null, 2], // 4: mesma categoria, grafia diferente
  ["0004", "Pintente", "pingente de ouro teste", 1.1, null, null], // 5: grafia observada de Pingente; sem índice
  ["8-0001", "Pingente", "pingente que coincide", 1, null, 1], // 6: coincide com FOLHEADOS
];

function planilhaFolheados(linhas = FOLHEADOS): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const f = wb.addWorksheet("FOLHEADOS");
  f.addRow(["PLANILHA DE TESTE"]);
  f.addRow(["CODIGO", "DESCRIÇÃO", "VALOR DE COMPRA", "PESO", "TAMANHO", "INDICE", "LOCAL DO ESTOQUE", "DATA DA COMPRA", "VALOR DE VENDA", "DATA VENDA", "CLIENTE"]);
  // A coluna CLIENTE recebe um nome que o leitor nunca pode trazer.
  for (const l of linhas) f.addRow([...l, "Cliente Que Nao Pode Vazar"]);
  const r = wb.addWorksheet("RAMON - PEÇAS");
  r.addRow(["MERCADORIA DE TESTE"]);
  r.addRow(["CODIGO", "DESCRIÇÃO", "VALOR DE COMPRA", "VALOR DE VENDA", "INDICE DE VENDA", "DATA DA VENDA", "TAMANHO", "CLIENTE", "VALOR VENDIDO"]);
  for (const l of RAMON) r.addRow(l);
  wb.addWorksheet("CATEGORIAS").addRow(["16 conjunto"]);
  return wb;
}

function planilhaCls(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("CLS teste");
  s.addRow(["CODIGO", "CATEGORIA", "DESCRIÇÃO", "PESO", "Ø", "Ind Preço"]);
  for (const l of CLS) s.addRow(l);
  return wb;
}

/** Ida e volta por buffer: o leitor recebe a planilha como viria de um arquivo. */
async function reabrir(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buffer = await wb.xlsx.writeBuffer();
  const outra = new ExcelJS.Workbook();
  await outra.xlsx.load(buffer);
  return outra;
}

async function lerTudo(folheados = planilhaFolheados()): Promise<LinhaImportacao[]> {
  const f = await reabrir(folheados);
  const c = await reabrir(planilhaCls());
  return [...lerFolheados(f, "folheados-teste.xlsx"), ...lerRamon(f, "folheados-teste.xlsx"), ...lerCls(c, "cls-teste.xlsx")];
}

let bd: Bd;
let admin: Ator;
let loginAdmin: string;
let resultado: ResultadoImportacao;

async function porCodigo(codigo: string) {
  return bd
    .selectFrom("app.produto as p")
    .innerJoin("app.material as m", "m.id", "p.material_id")
    .innerJoin("app.categoria as c", "c.id", "p.categoria_id")
    .leftJoin("app.saldo_estoque as s", "s.produto_id", "p.id")
    .innerJoin("app.produto_origem as o", "o.produto_id", "p.id")
    .select([
      "p.id", "p.tamanho", "p.local_estoque", "p.consignado_com", "p.valor_aquisicao", "p.data_aquisicao", "p.indice_preco",
      "p.modo_controle", "m.nome as material", "c.nome as categoria", "c.usa_tamanho",
      sql<number>`coalesce(s.quantidade, 0)`.as("saldo"),
      "o.situacao_original", "o.tamanho_original", "o.local_original", "o.aba", "o.linha",
    ])
    .where("p.codigo", "=", codigo)
    .executeTakeFirst();
}

async function ocorrencias(codigo: string | null, aba?: string) {
  let q = bd.selectFrom("app.importacao_ocorrencia").select(["tipo", "motivo", "aba", "linha"]);
  q = codigo === null ? q.where("codigo", "is", null) : q.where("codigo", "=", codigo);
  if (aba) q = q.where("aba", "=", aba);
  return q.orderBy("linha").execute();
}

beforeAll(async () => {
  await recriarBancoDeTeste();
  bd = conectarComoAplicacao();
  const a = await criarAdministradorDeTeste(bd);
  admin = a.ator;
  loginAdmin = a.login;
  resultado = await importarPlanilhas(bd, { login: loginAdmin, arquivo: "folheados-teste.xlsx + cls-teste.xlsx", linhas: await lerTudo() });
});

afterAll(async () => {
  await bd?.destroy();
});

describe("Leitura das planilhas", () => {
  it("nunca lê a coluna CLIENTE e pula as linhas vazias", async () => {
    const linhas = await lerTudo();
    expect(JSON.stringify(linhas)).not.toContain("Cliente Que Nao Pode Vazar");
    expect(linhas.filter((l) => l.fonte === "FOLHEADOS")).toHaveLength(FOLHEADOS.length);
  });

  it("normaliza tamanho, data inválida e grafia de categoria", async () => {
    const linhas = await lerTudo();
    const anel = linhas.find((l) => l.codigo === "1-0001")!;
    expect(anel).toMatchObject({ tamanho: "16", tamanho_original: "T16", data_compra: "2025-01-02", chave_categoria: "ANEL" });
    expect(linhas.find((l) => l.codigo === "4-0011")).toMatchObject({ data_venda: null, data_venda_invalida: true });
    expect(linhas.find((l) => l.codigo === "0004")?.chave_categoria).toBe("PINTENTE");
  });
});

describe("Critério 4: regras RN-90 a RN-100", () => {
  it("RN-90: toda peça importada é UNITARIO", async () => {
    const { rows } = await sql<{ modo: string }>`select distinct modo_controle as modo from app.produto`.execute(bd);
    expect(rows).toEqual([{ modo: "UNITARIO" }]);
  });

  it("RN-91: código repetido tem todas as ocorrências rejeitadas; Serviço é rejeitado", async () => {
    expect(await porCodigo("4-0012")).toBeUndefined();
    expect((await ocorrencias("4-0012")).map((o) => [o.tipo, o.motivo, o.linha])).toEqual([
      ["REJEITADA", "Código repetido", 15],
      ["REJEITADA", "Código repetido", 16],
    ]);
    const servicos = await ocorrencias("SERVIÇO");
    expect(servicos.map((o) => [o.aba, o.motivo]).sort()).toEqual([
      ["FOLHEADOS", "Linha de serviço"],
      ["RAMON - PEÇAS", "Linha de serviço"],
    ]);
  });

  it("RN-92: material pelo padrão do código; padrão desconhecido é rejeitado", async () => {
    expect((await porCodigo("4-0002"))?.material).toBe("Folheado");
    expect((await porCodigo("R0700001"))?.material).toBe("Prata");
    expect((await porCodigo("0001"))?.material).toBe("Ouro");
    expect(await porCodigo("X-ABC")).toBeUndefined();
    expect((await ocorrencias("X-ABC"))[0]).toMatchObject({ tipo: "REJEITADA", motivo: "Padrão de código desconhecido" });
  });

  it("RN-92: código do CLS que coincide com outra fonte tem as duas ocorrências rejeitadas", async () => {
    expect(await porCodigo("8-0001")).toBeUndefined();
    expect((await ocorrencias("8-0001")).map((o) => o.aba).sort()).toEqual(["CLS teste", "FOLHEADOS"]);
  });

  it("RN-93: categoria pela primeira palavra e pelas grafias; fora da tabela, A classificar", async () => {
    expect((await porCodigo("4-0003"))?.categoria).toBe("Brinco");
    expect((await porCodigo("4-0004"))?.categoria).toBe("Brinco");
    expect((await porCodigo("0002"))?.categoria).toBe("Brinco");
    expect((await porCodigo("0003"))?.categoria).toBe("Brinco");
    expect((await porCodigo("0004"))?.categoria).toBe("Pingente");
    expect((await porCodigo("4-0013"))?.categoria).toBe("A classificar");
    expect((await ocorrencias("4-0013"))[0]).toMatchObject({ tipo: "REVISAR", motivo: "Categoria a classificar" });
    expect((await porCodigo("1-0001"))?.usa_tamanho).toBe(true);
    const categorias = await bd.selectFrom("app.categoria").select("nome").execute();
    // Uma categoria por nome, sem duplicar por grafia.
    expect(categorias.filter((c) => c.nome.toLowerCase() === "brinco")).toHaveLength(1);
  });

  it("RN-94 e RN-94A: tamanho só em anel; nas outras categorias fica na origem para revisão", async () => {
    expect(await porCodigo("1-0001")).toMatchObject({ tamanho: "16", tamanho_original: "T16", valor_aquisicao: "100.00", data_aquisicao: "2025-01-02", indice_preco: "200.0000" });
    expect(await porCodigo("0001")).toMatchObject({ tamanho: "17", tamanho_original: "17" });
    expect(await porCodigo("4-0014")).toMatchObject({ tamanho: null, tamanho_original: "T 18" });
    expect(await porCodigo("0002")).toMatchObject({ tamanho: null, tamanho_original: "5" });
    // Aliança também usa tamanho (decisão de 2026-11-22): grava normalmente, sem revisão.
    expect(await porCodigo("13-0001")).toMatchObject({ categoria: "Aliança", usa_tamanho: true, tamanho: "20", tamanho_original: "T 20" });
    expect(await ocorrencias("13-0001")).toEqual([]);
    expect((await ocorrencias("0002"))[0]).toMatchObject({ tipo: "REVISAR", motivo: "Tamanho em categoria que não usa tamanho" });
  });

  it("RN-95: cada valor de local vira a situação e o saldo previstos", async () => {
    const esperado: [string, string, string | null, number][] = [
      ["1-0001", "EM_ESTOQUE", "Estoque", 1],
      ["4-0002", "EM_ESTOQUE", "Armário", 1],
      ["4-0003", "EM_ESTOQUE", "Maleta 1", 1],
      ["4-0004", "EM_ESTOQUE", "Maleta 2", 1],
      ["4-0005", "EM_ESTOQUE", "Estoque", 1],
      ["4-0006", "CONSIGNADA", "Consignado", 1],
      ["4-0007", "VENDIDA", null, 0],
      ["4-0009", "PERDIDA", null, 0],
      ["4-0010", "REVISAR", null, 0],
    ];
    for (const [codigo, situacao, local, saldo] of esperado) {
      expect(await porCodigo(codigo), codigo).toMatchObject({ situacao_original: situacao, local_estoque: local, saldo });
    }
    expect((await porCodigo("4-0006"))?.consignado_com).toBe(PESSOA);
    expect((await ocorrencias("4-0010"))[0]).toMatchObject({ tipo: "REVISAR", motivo: "Local do estoque vazio" });
    // Vendido sem data conta como vendido, sem revisão e sem venda histórica (a data não é inventada).
    expect(await porCodigo("4-0015")).toMatchObject({ situacao_original: "VENDIDA", saldo: 0 });
    expect(await ocorrencias("4-0015")).toEqual([]);
    const semData = await bd
      .selectFrom("app.venda_historica as v")
      .innerJoin("app.produto as p", "p.id", "v.produto_id")
      .select("v.id")
      .where("p.codigo", "=", "4-0015")
      .execute();
    expect(semData).toEqual([]);
  });

  it("RN-96 e RN-99: venda prevalece sobre o local, com revisão; R$ 0,01 é simbólico", async () => {
    expect(await porCodigo("4-0008")).toMatchObject({ situacao_original: "VENDIDA", saldo: 0 });
    expect((await ocorrencias("4-0008"))[0]).toMatchObject({ tipo: "REVISAR", motivo: "Venda registrada com local diferente de VENDIDO" });
    const historicas = await bd
      .selectFrom("app.venda_historica as v")
      .innerJoin("app.produto as p", "p.id", "v.produto_id")
      .select(["p.codigo", "v.data_venda", "v.valor_venda", "v.valor_compra", "v.simbolico"])
      .orderBy("p.codigo")
      .execute();
    expect(historicas).toEqual([
      { codigo: "4-0007", data_venda: "2026-01-10", valor_venda: "150.00", valor_compra: "70.00", simbolico: false },
      { codigo: "4-0008", data_venda: "2026-02-01", valor_venda: "0.01", valor_compra: "70.00", simbolico: true },
    ]);
  });

  it("RN-99: data de venda inválida leva a linha para revisão, sem venda histórica", async () => {
    expect(await porCodigo("4-0011")).toMatchObject({ situacao_original: "REVISAR", saldo: 0 });
    expect((await ocorrencias("4-0011"))[0]).toMatchObject({ tipo: "REVISAR", motivo: "Data de venda inválida" });
  });

  it("RN-100: peça que sumiu fica PERDIDA, sem movimentação", async () => {
    const p = await porCodigo("4-0009");
    const movs = await bd.selectFrom("app.movimentacao_estoque").select("id").where("produto_id", "=", p!.id).execute();
    expect(movs).toHaveLength(0);
  });

  it("RAMON: peça já existente em FOLHEADOS é rejeitada; a nova entra para revisão, sem local", async () => {
    expect((await ocorrencias("R0700001", "RAMON - PEÇAS"))[0]).toMatchObject({ tipo: "REJEITADA", motivo: "Peça já existe em FOLHEADOS" });
    expect(await porCodigo("R0700001")).toMatchObject({ aba: "FOLHEADOS", linha: 18 });
    expect(await porCodigo("R0700002")).toMatchObject({ aba: "RAMON - PEÇAS", situacao_original: "REVISAR", saldo: 0, material: "Prata" });
  });

  it("E11 e RN-97: peças do CLS com saldo 1, sem valor nem data de aquisição; implantação com custo do valor de aquisição", async () => {
    for (const codigo of ["0001", "0002", "0003", "0004"]) {
      expect(await porCodigo(codigo), codigo).toMatchObject({ saldo: 1, valor_aquisicao: null, data_aquisicao: null, situacao_original: "EM_ESTOQUE", local_estoque: "Estoque" });
    }
    const p = await porCodigo("1-0001");
    const mov = await bd.selectFrom("app.movimentacao_estoque").selectAll().where("produto_id", "=", p!.id).executeTakeFirstOrThrow();
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    expect(mov).toMatchObject({ tipo_codigo: "IMPLANTACAO", quantidade: 1, custo_unitario: "100.00", data_ocorrencia: hoje });
  });
});

describe("Critério 6: RN-105", () => {
  it("lidas = importadas + rejeitadas em cada aba, com as contagens esperadas", () => {
    expect(resultado.contagens).toEqual({
      FOLHEADOS: expect.objectContaining({ lidas: 21, importadas: 16, rejeitadas: 5, em_estoque: 9, consignadas: 1, vendidas: 3, perdidas: 1, a_revisar: 2, vendas_historicas: 2 }),
      "RAMON - PEÇAS": expect.objectContaining({ lidas: 3, importadas: 1, rejeitadas: 2, a_revisar: 1 }),
      "CLS teste": expect.objectContaining({ lidas: 5, importadas: 4, rejeitadas: 1, em_estoque: 4 }),
    });
    for (const c of Object.values(resultado.contagens)) expect(c.lidas).toBe(c.importadas + c.rejeitadas);
  });

  it("soma dos saldos = peças em estoque + consignadas; I2 vale para todas", () => {
    expect(resultado.conferencia).toEqual({ abasConferem: true, somaSaldos: 14, pecasEmEstoqueEConsignadas: 14, divergenciasDeSaldo: 0 });
  });
});

describe("Critério 8: RN-104, nenhum nome de pessoa nem descrição", () => {
  it("o resumo do comando só tem contagens e motivos", () => {
    const texto = JSON.stringify(resultado);
    for (const proibido of [PESSOA, DESCRICAO_SENSIVEL, "Cliente Que Nao Pode Vazar", "ANEL teste com tamanho"]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("as ocorrências e a auditoria não guardam nome nem descrição", async () => {
    const { rows } = await sql<{ t: string }>`
      select coalesce(string_agg(concat_ws('|', aba, codigo, motivo), ';'), '') as t from app.importacao_ocorrencia
    `.execute(bd);
    const { rows: aud } = await sql<{ t: string }>`
      select coalesce(string_agg(concat_ws('|', dados_antes::text, dados_depois::text), ';'), '') as t from app.auditoria
    `.execute(bd);
    for (const texto of [rows[0].t, aud[0].t]) {
      expect(texto).not.toContain(PESSOA);
      expect(texto).not.toContain(DESCRICAO_SENSIVEL);
      expect(texto).not.toContain("Cliente Que Nao Pode Vazar");
    }
  });

  it("a tela de ocorrências filtra por tipo e é só do administrador", async () => {
    const lote = resultado.loteId;
    const todas = await listarOcorrencias(bd, admin, { loteId: lote });
    const rejeitadas = await listarOcorrencias(bd, admin, { loteId: lote, tipo: "REJEITADA" });
    expect(rejeitadas.ocorrencias.length).toBeGreaterThan(0);
    expect(rejeitadas.ocorrencias.every((o) => o.tipo === "REJEITADA")).toBe(true);
    expect(rejeitadas.ocorrencias.length).toBeLessThan(todas.ocorrencias.length);
    const vendedor = (await criarUsuarioPronto(bd, admin, "VENDEDOR")).ator;
    await expect(listarOcorrencias(bd, vendedor, { loteId: lote })).rejects.toThrow(/Acesso negado/);
  });
});

describe("Critério 5: RN-101 e RN-102", () => {
  it("RN-101: a segunda execução é recusada", async () => {
    await expect(importarPlanilhas(bd, { login: loginAdmin, arquivo: "x", linhas: await lerTudo() })).rejects.toThrow(
      /já tem produtos/,
    );
    const { rows } = await sql<{ n: number }>`select count(*)::int as n from app.importacao_lote`.execute(bd);
    expect(rows[0].n).toBe(1);
  });

  it("RN-102: erro no meio da importação não deixa nenhuma linha gravada", async () => {
    await recriarBancoDeTeste();
    const a = await criarAdministradorDeTeste(bd);
    const linhas = await lerTudo();
    // Um peso que estoura numeric(10,3) numa linha do fim: as anteriores já teriam sido gravadas.
    const ultima = linhas.filter((l) => l.fonte === "CLS").at(-2)!;
    ultima.peso = "99999999999";
    await expect(importarPlanilhas(bd, { login: a.login, arquivo: "x", linhas })).rejects.toThrow();
    for (const tabela of ["produto", "importacao_lote", "importacao_ocorrencia", "movimentacao_estoque", "venda_historica", "produto_origem", "material", "categoria"]) {
      const { rows } = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${tabela}`)}`.execute(bd);
      expect(rows[0].n, tabela).toBe(0);
    }
  });

  it("só um administrador ativo importa", async () => {
    await expect(importarPlanilhas(bd, { login: "nao.existe", arquivo: "x", linhas: [] })).rejects.toBeInstanceOf(ErroNegocio);
  });
});
