// Executor de migrations: aplica, em ordem, os arquivos NNNN_*.sql de uma
// pasta, cada um na sua transação, e registra nome, SHA-256 e data. Recusa
// executar se um arquivo já aplicado tiver mudado ou sumido.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const PADRAO_ARQUIVO = /^\d{4}_[a-z0-9_]+\.sql$/;

// Número arbitrário e fixo: impede duas execuções simultâneas no mesmo banco.
const CHAVE_BLOQUEIO = 2026111001;

export class ErroMigracao extends Error {}

export interface ResultadoMigracao {
  aplicadas: string[];
  jaAplicadas: number;
}

/**
 * As quebras de linha são normalizadas antes do hash: um checkout no Windows
 * com conversão para CRLF não pode parecer uma migration alterada.
 */
export function hashMigracao(conteudo: string): string {
  return createHash("sha256").update(conteudo.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

export async function lerMigracoes(pasta: string): Promise<{ nome: string; sql: string; hash: string }[]> {
  const nomes = (await readdir(pasta)).filter((n) => n.endsWith(".sql")).sort();
  const invalidos = nomes.filter((n) => !PADRAO_ARQUIVO.test(n));
  if (invalidos.length > 0) {
    throw new ErroMigracao(
      `Nome de migration fora do padrão NNNN_descricao.sql: ${invalidos.join(", ")}.`,
    );
  }
  return Promise.all(
    nomes.map(async (nome) => {
      const sql = await readFile(path.join(pasta, nome), "utf8");
      return { nome, sql, hash: hashMigracao(sql) };
    }),
  );
}

export async function aplicarMigracoes(opcoes: {
  url: string;
  pasta: string;
  registrar?: (mensagem: string) => void;
}): Promise<ResultadoMigracao> {
  const registrar = opcoes.registrar ?? (() => {});
  const arquivos = await lerMigracoes(opcoes.pasta);
  const cliente = new pg.Client({ connectionString: opcoes.url });
  await cliente.connect();
  try {
    await cliente.query("select pg_advisory_lock($1)", [CHAVE_BLOQUEIO]);
    // A tabela de controle fica fora do esquema app, que é criado pela primeira migration.
    await cliente.query(`
      create schema if not exists migracao;
      create table if not exists migracao.historico (
        nome        text primary key,
        sha256      text not null,
        aplicada_em timestamptz not null default now()
      );
    `);

    const { rows } = await cliente.query<{ nome: string; sha256: string }>(
      "select nome, sha256 from migracao.historico order by nome",
    );
    const aplicadas = new Map(rows.map((r) => [r.nome, r.sha256]));
    const noDisco = new Map(arquivos.map((a) => [a.nome, a.hash]));

    const alteradas = [...aplicadas].filter(([nome, hash]) => noDisco.has(nome) && noDisco.get(nome) !== hash);
    const ausentes = [...aplicadas.keys()].filter((nome) => !noDisco.has(nome));
    if (alteradas.length > 0 || ausentes.length > 0) {
      const partes: string[] = [];
      if (alteradas.length > 0) {
        partes.push(`alterada(s) depois de aplicada(s): ${alteradas.map(([n]) => n).join(", ")}`);
      }
      if (ausentes.length > 0) partes.push(`aplicada(s) mas ausente(s) da pasta: ${ausentes.join(", ")}`);
      throw new ErroMigracao(
        `Execução recusada. Migration ${partes.join("; ")}. ` +
          "Uma migration aplicada não é editada: restaure o arquivo original e corrija com uma migration nova.",
      );
    }

    const pendentes = arquivos.filter((a) => !aplicadas.has(a.nome));
    for (const arquivo of pendentes) {
      registrar(`Aplicando ${arquivo.nome}...`);
      try {
        await cliente.query("begin");
        await cliente.query(arquivo.sql);
        await cliente.query("insert into migracao.historico (nome, sha256) values ($1, $2)", [
          arquivo.nome,
          arquivo.hash,
        ]);
        await cliente.query("commit");
      } catch (erro) {
        await cliente.query("rollback");
        const detalhe = erro instanceof Error ? erro.message : String(erro);
        throw new ErroMigracao(`Falha ao aplicar ${arquivo.nome}: ${detalhe}`);
      }
    }
    return { aplicadas: pendentes.map((a) => a.nome), jaAplicadas: aplicadas.size };
  } finally {
    await cliente.end();
  }
}
