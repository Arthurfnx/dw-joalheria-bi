"""
verificar_sql.py — validação ESTÁTICA dos arquivos SQL do ambiente demonstrativo,
sem conexão com o banco e sem dependências externas (somente biblioteca padrão).

Não substitui a execução real no PostgreSQL. Detecta:
  1. aspas simples, aspas duplas, comentários de bloco e dollar-quotes não fechados;
  2. parênteses desbalanceados (fora de strings e comentários);
  3. arquivo cuja última instrução não termina com ';';
  4. referências schema.objeto (schemas *_demo) a objetos não criados no projeto;
  5. CALL de algo que não é PROCEDURE e uso de PROCEDURE sem CALL;
  6. colunas de INSERT INTO <tabela> (...) inexistentes na tabela criada;
  7. variáveis/parâmetros PL/pgSQL com o mesmo nome de colunas (risco de ambiguidade);
  8. referências a schemas do ambiente real (staging., dw., bi., audit.);
  9. restrição proibida "realizado <= marcado" e colunas de cliente;
 10. subconsulta nos argumentos de CALL (o PostgreSQL rejeita em tempo de
     execução: "não é possível usar subconsulta no argumento do CALL").

Antes da análise, a regra 10 passa por um autoteste com casos positivos e
negativos; se o autoteste falhar, o verificador termina com código 1.

Uso:  python tests/estatico/verificar_sql.py
Saída: código 0 se nenhum problema; 1 caso contrário.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PASTAS = [RAIZ / "db" / "migrations", RAIZ / "etl" / "sql" / "demo", RAIZ / "db" / "views", RAIZ / "tests" / "sql"]
SCHEMAS_DEMO = ("config_demo", "staging_demo", "dw_demo", "bi_demo", "audit_demo")
SCHEMAS_REAIS = ("staging", "dw", "bi", "audit")

problemas: list[str] = []


def problema(arquivo: Path, msg: str) -> None:
    problemas.append(f"{arquivo.relative_to(RAIZ).as_posix()}: {msg}")


def remover_comentarios_e_strings(texto: str, arquivo: Path) -> str:
    """Substitui comentários e literais por espaços, mantendo dollar-quotes como código.

    Corpos $$...$$ de funções contêm SQL/PLpgSQL e são analisados como código.
    """
    saida = []
    i, n = 0, len(texto)
    pilha_dollar: list[str] = []
    while i < n:
        c = texto[i]
        if texto.startswith("--", i):
            fim = texto.find("\n", i)
            fim = n if fim == -1 else fim
            saida.append(" " * (fim - i))
            i = fim
        elif texto.startswith("/*", i):
            fim = texto.find("*/", i + 2)
            if fim == -1:
                problema(arquivo, "comentário de bloco não fechado")
                return "".join(saida)
            saida.append(" " * (fim + 2 - i))
            i = fim + 2
        elif c == "'":
            j = i + 1
            while True:
                if j >= n:
                    problema(arquivo, f"aspas simples não fechadas (posição {i})")
                    return "".join(saida)
                if texto[j] == "'":
                    if j + 1 < n and texto[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            saida.append("''" + " " * (j - i - 1))
            i = j + 1
        elif c == '"':
            fim = texto.find('"', i + 1)
            if fim == -1:
                problema(arquivo, "aspas duplas não fechadas")
                return "".join(saida)
            saida.append(texto[i:fim + 1])
            i = fim + 1
        elif c == "$":
            m = re.match(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$", texto[i:])
            if m:
                tag = m.group(0)
                if pilha_dollar and pilha_dollar[-1] == tag:
                    pilha_dollar.pop()
                else:
                    pilha_dollar.append(tag)
                saida.append(" " * len(tag))
                i += len(tag)
            else:
                saida.append(c)
                i += 1
        else:
            saida.append(c)
            i += 1
    if pilha_dollar:
        problema(arquivo, f"dollar-quote não fechado: {pilha_dollar}")
    return "".join(saida)


def verificar_parenteses(codigo: str, arquivo: Path) -> None:
    nivel = 0
    linha = 1
    for ch in codigo:
        if ch == "\n":
            linha += 1
        elif ch == "(":
            nivel += 1
        elif ch == ")":
            nivel -= 1
            if nivel < 0:
                problema(arquivo, f"')' sem '(' correspondente perto da linha {linha}")
                return
    if nivel != 0:
        problema(arquivo, f"parênteses desbalanceados (saldo {nivel})")


def coletar_objetos(codigos: dict[Path, str]):
    tabelas: dict[str, list[str]] = {}
    views: set[str] = set()
    funcoes: set[str] = set()
    procedures: set[str] = set()
    outros: set[str] = set()
    padrao = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(TABLE|VIEW|FUNCTION|PROCEDURE|INDEX|TRIGGER)\s+"
        r"(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)",
        re.IGNORECASE,
    )
    for arq, cod in codigos.items():
        if "tests" in arq.parts:
            continue
        for m in padrao.finditer(cod):
            tipo, nome = m.group(1).upper(), m.group(2).lower()
            if tipo == "TABLE":
                if nome.startswith("pg_temp.") or "." not in nome:
                    continue
                abre = cod.find("(", m.end())
                tabelas[nome] = extrair_colunas(cod, abre)
            elif tipo == "VIEW":
                views.add(nome)
            elif tipo == "FUNCTION":
                funcoes.add(nome)
            elif tipo == "PROCEDURE":
                procedures.add(nome)
            else:
                outros.add(nome)
    return tabelas, views, funcoes, procedures


def extrair_colunas(cod: str, abre: int) -> list[str]:
    nivel, i = 0, abre
    while i < len(cod):
        if cod[i] == "(":
            nivel += 1
        elif cod[i] == ")":
            nivel -= 1
            if nivel == 0:
                break
        i += 1
    corpo = cod[abre + 1:i]
    itens, atual, nivel = [], [], 0
    for ch in corpo:
        if ch == "(":
            nivel += 1
        elif ch == ")":
            nivel -= 1
        if ch == "," and nivel == 0:
            itens.append("".join(atual))
            atual = []
        else:
            atual.append(ch)
    itens.append("".join(atual))
    colunas = []
    for item in itens:
        palavra = item.strip().split()
        if not palavra:
            continue
        p = palavra[0].lower()
        if p in ("constraint", "primary", "unique", "check", "foreign", "exclude"):
            continue
        colunas.append(p.strip('"'))
    return colunas


def extrair_parenteses(cod: str, abre: int) -> str:
    """Conteúdo entre o '(' na posição abre e o ')' correspondente."""
    nivel, i = 0, abre
    while i < len(cod):
        if cod[i] == "(":
            nivel += 1
        elif cod[i] == ")":
            nivel -= 1
            if nivel == 0:
                return cod[abre + 1:i]
        i += 1
    return cod[abre + 1:]


def dividir_nivel_zero(texto: str) -> list[str]:
    itens, atual, nivel = [], [], 0
    for ch in texto:
        if ch == "(":
            nivel += 1
        elif ch == ")":
            nivel -= 1
        if ch == "," and nivel == 0:
            itens.append("".join(atual))
            atual = []
        else:
            atual.append(ch)
    itens.append("".join(atual))
    return itens


# Subconsulta (sublink) em argumento: (SELECT ...), (WITH ...), (VALUES ...),
# (TABLE ...), EXISTS (...), ARRAY(SELECT ...) e x IN (SELECT ...).
SUBCONSULTA = re.compile(r"\(\s*(?:select|with|values|table)\b|\bexists\s*\(", re.IGNORECASE)
AUTOTESTE_POSITIVOS = AUTOTESTE_NEGATIVOS = 0
CALL_ARGS = re.compile(r"\bcall\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s*\(", re.IGNORECASE)


def subconsultas_em_call(codigo: str) -> list[tuple[str, int]]:
    """Devolve (procedure, linha) de cada CALL com subconsulta nos argumentos.

    `codigo` deve estar sem comentários e literais (remover_comentarios_e_strings),
    para que textos como 'SELECT' dentro de strings não sejam acusados.
    """
    achados = []
    for m in CALL_ARGS.finditer(codigo):
        argumentos = extrair_parenteses(codigo, m.end() - 1)
        if SUBCONSULTA.search(argumentos):
            achados.append((m.group(1).lower(), codigo.count("\n", 0, m.start()) + 1))
    return achados


def autoteste_call() -> list[str]:
    """Casos positivos (devem ser acusados) e negativos (devem ser aceitos) da regra 10."""
    positivos = {
        "subconsulta direta": "CALL a.p(v_x, (SELECT count(*) FROM t WHERE id = v_x), 'ok');",
        "subconsulta dentro de format": "CALL a.p(1, format('n=%s', (SELECT count(*) FROM t)));",
        "subconsulta em várias linhas": "CALL a.p(v_x,\n    (\n  select max(c) from t));",
        "EXISTS": "CALL a.p(EXISTS (SELECT 1 FROM t));",
        "IN (SELECT)": "CALL a.p(v_x IN (SELECT c FROM t));",
        "ARRAY(SELECT)": "CALL a.p(ARRAY(SELECT c FROM t));",
        "WITH": "CALL a.p((WITH x AS (SELECT 1) SELECT * FROM x));",
    }
    negativos = {
        "somente variáveis": "CALL a.p(p_exec, 'etapa', v_inicio, v_lidas, v_carg, v_rej, 'msg');",
        "format com variáveis": "CALL a.p(1, format('a=%s; b=%s', v_a, v_b));",
        "CASE e expressões": "CALL a.p(v_x, CASE WHEN v_f = 0 THEN 'ok' ELSE 'erro' END, v_a + (v_b * 2));",
        "SELECT dentro de literal": "CALL a.p('texto com (SELECT 1) dentro');",
        "SELECT INTO antes do CALL": "SELECT count(*) INTO v_n FROM t; CALL a.p(v_n);",
        "subconsulta fora do CALL": "PERFORM (SELECT 1); CALL a.p(v_n); x := (SELECT 2);",
    }
    global AUTOTESTE_POSITIVOS, AUTOTESTE_NEGATIVOS
    AUTOTESTE_POSITIVOS, AUTOTESTE_NEGATIVOS = len(positivos), len(negativos)
    falhas = []
    for nome, sql in positivos.items():
        cod = remover_comentarios_e_strings(sql, RAIZ / "autoteste.sql").lower()
        if not subconsultas_em_call(cod):
            falhas.append(f"autoteste (positivo não detectado): {nome}")
    for nome, sql in negativos.items():
        cod = remover_comentarios_e_strings(sql, RAIZ / "autoteste.sql").lower()
        if subconsultas_em_call(cod):
            falhas.append(f"autoteste (falso positivo): {nome}")
    return falhas


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    falhas_autoteste = autoteste_call()
    if falhas_autoteste:
        print("Autoteste da regra de subconsulta em CALL FALHOU:")
        for f in falhas_autoteste:
            print(f"  - {f}")
        return 1
    print(f"Autoteste da regra de subconsulta em CALL: {AUTOTESTE_POSITIVOS} positivos detectados, "
          f"{AUTOTESTE_NEGATIVOS} negativos aceitos.")
    arquivos = [a for pasta in PASTAS for a in sorted(pasta.glob("*.sql"))]
    if not arquivos:
        print("Nenhum arquivo SQL encontrado.")
        return 1
    codigos = {}
    for arq in arquivos:
        texto = arq.read_text(encoding="utf-8")
        if texto.startswith("﻿"):
            problema(arq, "arquivo com BOM UTF-8 (pode atrapalhar o psql)")
        cod = remover_comentarios_e_strings(texto, arq)
        codigos[arq] = cod
        verificar_parenteses(cod, arq)
        if cod.strip() and not cod.rstrip().endswith(";"):
            problema(arq, "a última instrução não termina com ';'")

    tabelas, views, funcoes, procedures = coletar_objetos(codigos)
    relacoes = set(tabelas) | views
    todos = relacoes | funcoes | procedures
    todas_colunas = {c for cols in tabelas.values() for c in cols}

    ref = re.compile(r"\b(" + "|".join(SCHEMAS_DEMO) + r")\.([a-z_][a-z0-9_]*)", re.IGNORECASE)
    ref_real = re.compile(r"(?<![a-z0-9_.])(" + "|".join(SCHEMAS_REAIS) + r")\.([a-z_][a-z0-9_]*)", re.IGNORECASE)
    call = re.compile(r"\bCALL\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)", re.IGNORECASE)
    insert = re.compile(r"INSERT\s+INTO\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(([^)]*)\)", re.IGNORECASE)
    declare = re.compile(r"\bDECLARE\b(.*?)\bBEGIN\b", re.IGNORECASE | re.DOTALL)
    params = re.compile(r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+[a-z_][a-z0-9_.]*\s*\(", re.IGNORECASE)

    for arq, cod in codigos.items():
        baixo = cod.lower()
        for m in ref.finditer(baixo):
            nome = f"{m.group(1)}.{m.group(2)}"
            if nome not in todos:
                problema(arq, f"referência a objeto inexistente: {nome}")
        for m in ref_real.finditer(baixo):
            problema(arq, f"referência a schema do ambiente real: {m.group(0)}")
        for m in call.finditer(baixo):
            nome = m.group(1)
            if nome not in procedures:
                problema(arq, f"CALL de objeto que não é procedure: {nome}")
        for nome, linha in subconsultas_em_call(baixo):
            problema(arq, f"linha {linha}: subconsulta no argumento de CALL {nome} (não suportado pelo PostgreSQL)")
        for p in procedures:
            for m in re.finditer(r"(\w+\s+)?\b" + re.escape(p) + r"\s*\(", baixo):
                anterior = (m.group(1) or "").strip()
                if anterior not in ("call", "procedure", "on", "comment"):
                    problema(arq, f"procedure usada sem CALL: {p}")
        for m in insert.finditer(baixo):
            tabela = m.group(1)
            if tabela in tabelas:
                for col in [c.strip() for c in m.group(2).split(",") if c.strip()]:
                    if col not in tabelas[tabela]:
                        problema(arq, f"INSERT em {tabela}: coluna inexistente '{col}'")
        for m in declare.finditer(baixo):
            for linha in m.group(1).split(";"):
                partes = linha.strip().split()
                if partes and re.fullmatch(r"[a-z_][a-z0-9_]*", partes[0]) and partes[0] in todas_colunas:
                    problema(arq, f"variável PL/pgSQL com nome de coluna (ambiguidade): {partes[0]}")
        for m in params.finditer(baixo):
            lista = extrair_parenteses(baixo, m.end() - 1)
            for par in dividir_nivel_zero(lista):
                partes = par.strip().split()
                if partes and partes[0] in todas_colunas:
                    problema(arq, f"parâmetro com nome de coluna (ambiguidade): {partes[0]}")
        if re.search(r"preco_vendido_realizado_unitario\s*<=\s*preco_venda_marcado_unitario", baixo) and "check" in baixo:
            if "tests" not in arq.parts:
                problema(arq, "restrição proibida realizado <= marcado")

    for tabela, cols in tabelas.items():
        for c in cols:
            if "cliente" in c:
                problema(RAIZ / "db" / "migrations", f"coluna de cliente em {tabela}: {c}")

    print(f"Arquivos analisados: {len(arquivos)}")
    print(f"Objetos encontrados: {len(tabelas)} tabelas, {len(views)} views, "
          f"{len(funcoes)} funções, {len(procedures)} procedures")
    if problemas:
        print(f"\n{len(problemas)} problema(s):")
        for p in problemas:
            print(f"  - {p}")
        return 1
    print("Nenhum problema estático encontrado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
