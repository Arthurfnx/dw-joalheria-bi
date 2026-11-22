import { describe, expect, it } from "vitest";
import { apagarEsquemasDeTeste, ErroBancoNaoEhDeTeste, garantirBancoDeTeste } from "@/servidor/bd/banco-teste";
import { nomeDoBanco } from "@/servidor/bd/conexao";
import { hashMigracao } from "@/servidor/bd/migracoes";
import { cookieDeveSerSeguro, mesmaOrigem } from "@/servidor/seguranca/origem";
import { gerarTokenSessao, hashToken } from "@/servidor/seguranca/token";

describe("Mesma origem nas requisições que alteram dados", () => {
  it("aceita a própria origem", () => {
    expect(mesmaOrigem("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(mesmaOrigem("https://loja.exemplo.com", "loja.exemplo.com")).toBe(true);
  });

  it.each([
    [null, "localhost:3000"],
    ["null", "localhost:3000"],
    ["http://localhost:3001", "localhost:3000"],
    ["https://atacante.exemplo.com", "loja.exemplo.com"],
    ["file://", "localhost:3000"],
    ["http://localhost:3000", null],
  ])("recusa origem %j para o host %j", (origem, host) => {
    expect(mesmaOrigem(origem, host)).toBe(false);
  });
});

describe("RN-05: cookie de sessão", () => {
  it("é Secure em produção fora do computador local", () => {
    expect(cookieDeveSerSeguro("production", "loja.exemplo.com")).toBe(true);
    expect(cookieDeveSerSeguro("production", "192.168.0.10:3000")).toBe(true);
  });

  it("dispensa Secure em desenvolvimento e no próprio computador", () => {
    expect(cookieDeveSerSeguro("development", "loja.exemplo.com")).toBe(false);
    expect(cookieDeveSerSeguro("production", "localhost:3000")).toBe(false);
    expect(cookieDeveSerSeguro("production", "127.0.0.1:3000")).toBe(false);
  });

  it("o token é aleatório e o hash guardado não é o token", () => {
    const a = gerarTokenSessao();
    const b = gerarTokenSessao();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});

describe("Rotina destrutiva só em banco _teste", () => {
  it("lê o nome do banco da cadeia de conexão", () => {
    expect(nomeDoBanco("postgresql://papel:x@localhost:5432/nobreza_app_teste")).toBe("nobreza_app_teste");
  });

  it("recusa banco cujo nome não termina em _teste", () => {
    for (const nome of ["nobreza_app", "dw_joalheria", "nobreza_teste_app", "postgres"]) {
      expect(() => garantirBancoDeTeste(nome)).toThrow(ErroBancoNaoEhDeTeste);
    }
    expect(() => garantirBancoDeTeste("nobreza_app_teste")).not.toThrow();
  });

  it("recusa recriar o esquema de outro banco antes mesmo de conectar", async () => {
    // Porta 1 não tem servidor: se a verificação falhasse, o erro seria de conexão, não este.
    await expect(apagarEsquemasDeTeste("postgresql://papel:x@127.0.0.1:1/nobreza_app")).rejects.toBeInstanceOf(
      ErroBancoNaoEhDeTeste,
    );
  });
});

describe("Hash de migration", () => {
  it("ignora a diferença entre CRLF e LF", () => {
    expect(hashMigracao("select 1;\r\nselect 2;\r\n")).toBe(hashMigracao("select 1;\nselect 2;\n"));
    expect(hashMigracao("select 1;")).not.toBe(hashMigracao("select 2;"));
  });
});
