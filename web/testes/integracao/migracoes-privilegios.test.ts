// Critérios de aceite 2 e 3: migrations e privilégios do papel da aplicação.

import { cp, mkdtemp, rm, writeFile, appendFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apagarEsquemasDeTeste } from "@/servidor/bd/banco-teste";
import { aplicarMigracoes, ErroMigracao } from "@/servidor/bd/migracoes";
import type { Bd } from "@/servidor/bd/conexao";
import { conectarComoAplicacao, conectarComoDono, PASTA_MIGRACOES, urlMigracaoTeste } from "../apoio/banco";

let pastaTemporaria: string;
let app: Bd;
let dono: Bd;

beforeAll(async () => {
  await apagarEsquemasDeTeste(urlMigracaoTeste());
  pastaTemporaria = await mkdtemp(path.join(os.tmpdir(), "nobreza-migracoes-"));
  await cp(PASTA_MIGRACOES, pastaTemporaria, { recursive: true });
  app = conectarComoAplicacao();
  dono = conectarComoDono();
});

afterAll(async () => {
  await app?.destroy();
  await dono?.destroy();
  if (pastaTemporaria) await rm(pastaTemporaria, { recursive: true, force: true });
});

describe("Critério 2: executor de migrations", () => {
  it("num banco vazio, cria toda a estrutura", async () => {
    const resultado = await aplicarMigracoes({ url: urlMigracaoTeste(), pasta: pastaTemporaria });
    expect(resultado.aplicadas).toEqual([
      "0001_esquema_usuario_sessao.sql",
      "0002_cadastros_dominio.sql",
      "0003_auditoria_configuracao.sql",
      "0004_privilegios_aplicacao.sql",
      "0005_produto_estoque.sql",
      "0006_importacao_preco_ouro.sql",
      "0007_funcoes_estoque_importacao.sql",
      "0008_privilegios_produto_estoque.sql",
      "0009_alianca_com_tamanho.sql",
      "0010_funcoes_venda.sql",
    ]);

    const tabelas = await sql<{ table_name: string }>`
      select table_name from information_schema.tables where table_schema = 'app' order by table_name
    `.execute(dono);
    expect(tabelas.rows.map((t) => t.table_name)).toEqual([
      "auditoria",
      "categoria",
      "compra",
      "compra_item",
      "configuracao",
      "divergencia_saldo",
      "importacao_lote",
      "importacao_ocorrencia",
      "material",
      "movimentacao_estoque",
      "preco_ouro",
      "produto",
      "produto_origem",
      "saldo_estoque",
      "sessao",
      "subcategoria",
      "tipo_movimentacao",
      "usuario",
      "venda",
      "venda_historica",
      "venda_item",
    ]);

    const historico = await sql<{ nome: string; sha256: string }>`
      select nome, sha256 from migracao.historico order by nome
    `.execute(dono);
    expect(historico.rows).toHaveLength(10);
    for (const linha of historico.rows) expect(linha.sha256).toMatch(/^[0-9a-f]{64}$/);

    const config = await app.selectFrom("app.configuracao").select(["chave", "valor"]).orderBy("chave").execute();
    expect(config).toEqual([
      { chave: "dias_produto_parado", valor: "180" },
      { chave: "fator_preco_ouro", valor: "1.6" },
    ]);
  });

  it("executado de novo, não faz nada", async () => {
    const resultado = await aplicarMigracoes({ url: urlMigracaoTeste(), pasta: pastaTemporaria });
    expect(resultado).toEqual({ aplicadas: [], jaAplicadas: 10 });
  });

  it("com um arquivo já aplicado alterado, falha com mensagem clara e nada é aplicado", async () => {
    const alterado = path.join(pastaTemporaria, "0002_cadastros_dominio.sql");
    await appendFile(alterado, "\n-- alteração indevida\n");
    await writeFile(path.join(pastaTemporaria, "0099_nova.sql"), "create table app.nao_deve_existir (id int);");

    await expect(aplicarMigracoes({ url: urlMigracaoTeste(), pasta: pastaTemporaria })).rejects.toThrow(
      /alterada\(s\) depois de aplicada\(s\): 0002_cadastros_dominio\.sql/,
    );

    const existe = await sql<{ existe: boolean }>`select to_regclass('app.nao_deve_existir') is not null as existe`.execute(dono);
    expect(existe.rows[0].existe).toBe(false);
  });

  it("recusa quando um arquivo aplicado some da pasta", async () => {
    await cp(path.join(PASTA_MIGRACOES, "0002_cadastros_dominio.sql"), path.join(pastaTemporaria, "0002_cadastros_dominio.sql"));
    await unlink(path.join(pastaTemporaria, "0099_nova.sql"));
    await unlink(path.join(pastaTemporaria, "0003_auditoria_configuracao.sql"));
    await expect(aplicarMigracoes({ url: urlMigracaoTeste(), pasta: pastaTemporaria })).rejects.toBeInstanceOf(
      ErroMigracao,
    );
  });

  it("uma migration com erro é desfeita por inteiro", async () => {
    await cp(PASTA_MIGRACOES, pastaTemporaria, { recursive: true });
    await writeFile(
      path.join(pastaTemporaria, "0099_com_erro.sql"),
      "create table app.parcial (id int);\nselect 1 / 0;",
    );
    await expect(aplicarMigracoes({ url: urlMigracaoTeste(), pasta: pastaTemporaria })).rejects.toThrow(
      /Falha ao aplicar 0099_com_erro\.sql/,
    );
    const existe = await sql<{ existe: boolean }>`select to_regclass('app.parcial') is not null as existe`.execute(dono);
    expect(existe.rows[0].existe).toBe(false);
  });
});

function codigoDoErro(erro: unknown): string | undefined {
  return (erro as { code?: string }).code;
}

describe("Critério 3: privilégios de nobreza_aplicacao", () => {
  it("pode inserir e ler na auditoria", async () => {
    await app
      .insertInto("app.auditoria")
      .values({ usuario_id: null, acao: "TESTE", entidade: "teste" })
      .execute();
    const linhas = await app.selectFrom("app.auditoria").select("acao").where("acao", "=", "TESTE").execute();
    expect(linhas).toHaveLength(1);
  });

  it("UPDATE em app.auditoria é recusado", async () => {
    const erro = await sql`update app.auditoria set acao = 'X'`.execute(app).catch((e: unknown) => e);
    expect(codigoDoErro(erro)).toBe("42501");
  });

  it("DELETE em app.auditoria é recusado", async () => {
    const erro = await sql`delete from app.auditoria`.execute(app).catch((e: unknown) => e);
    expect(codigoDoErro(erro)).toBe("42501");
  });

  it("CREATE TABLE no esquema app é recusado", async () => {
    const erro = await sql`create table app.invasora (id int)`.execute(app).catch((e: unknown) => e);
    expect(codigoDoErro(erro)).toBe("42501");
  });

  it("não lê nem grava na tabela de controle das migrations", async () => {
    const erro = await sql`select * from migracao.historico`.execute(app).catch((e: unknown) => e);
    expect(codigoDoErro(erro)).toBe("42501");
  });

  it("não apaga linhas de usuário nem de sessão (sem exclusão física)", async () => {
    for (const tabela of ["app.usuario", "app.sessao", "app.material"]) {
      const erro = await sql`delete from ${sql.table(tabela)}`.execute(app).catch((e: unknown) => e);
      expect(codigoDoErro(erro), tabela).toBe("42501");
    }
  });

  it("até o dono do esquema é barrado pelo gatilho ao alterar ou apagar a auditoria", async () => {
    await expect(sql`update app.auditoria set acao = 'X'`.execute(dono)).rejects.toThrow(
      /auditoria não pode ser alterada/,
    );
    await expect(sql`delete from app.auditoria`.execute(dono)).rejects.toThrow(/auditoria não pode ser alterada/);
  });
});
