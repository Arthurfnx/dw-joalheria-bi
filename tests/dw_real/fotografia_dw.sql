-- =============================================================================
-- fotografia_dw.sql — retrato do conteúdo do DW real: linhas
-- e md5 de cada tabela de dw (sem id_execucao, que muda a cada carga) e de
-- cada view de bi (sem colunas de execução e de horário da carga). Usado por
-- tests/dw_real/conferir_idempotencia.ps1 (critério 3 da T04).
-- =============================================================================
-- Usa só uma tabela temporária e termina em ROLLBACK: nada é gravado.
BEGIN;

CREATE TEMP TABLE foto (item text, linhas bigint, md5 text) ON COMMIT DROP;

DO $$
DECLARE
    r       record;
    v_cols  text;
    v_n     bigint;
    v_md5   text;
BEGIN
    FOR r IN SELECT c.relname, n.nspname
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE (n.nspname = 'dw' AND c.relkind = 'r') OR (n.nspname = 'bi' AND c.relkind = 'v')
              ORDER BY n.nspname, c.relname
    LOOP
        SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO v_cols
          FROM pg_attribute a
         WHERE a.attrelid = format('%I.%I', r.nspname, r.relname)::regclass
           AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname NOT IN ('id_execucao', 'id_ultima_execucao', 'status_ultima_execucao',
                                 'ultima_carga_em', 'extraido_em', 'atualizado_em');
        EXECUTE format('SELECT count(*), md5(coalesce(string_agg(x::text, %L ORDER BY x::text), %L)) FROM (SELECT %s FROM %I.%I) x',
                       '|', '', v_cols, r.nspname, r.relname)
           INTO v_n, v_md5;
        INSERT INTO foto VALUES (r.nspname || '.' || r.relname, v_n, v_md5);
    END LOOP;
END;
$$;

SELECT item || ' linhas=' || linhas || ' md5=' || md5 FROM foto ORDER BY item;

ROLLBACK;
