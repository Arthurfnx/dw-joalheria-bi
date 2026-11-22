-- =============================================================================
-- fotografia_demo.sql — retrato SOMENTE LEITURA dos esquemas *_demo (fase 1).
-- Usado por tests/dw_real/conferir_demo_intacto.ps1 antes e depois das
-- migrations do DW real: objetos por tipo, linhas por tabela e um md5 das
-- definições (views, funções, restrições e gatilhos). Nada é alterado.
-- =============================================================================
BEGIN TRANSACTION READ ONLY;

WITH esquemas AS (
    SELECT oid, nspname FROM pg_namespace
     WHERE nspname IN ('config_demo', 'staging_demo', 'dw_demo', 'bi_demo', 'audit_demo')
),
objetos AS (
    SELECT e.nspname, 'relacao_' || c.relkind::text AS tipo, count(*) AS n
      FROM pg_class c JOIN esquemas e ON e.oid = c.relnamespace
     GROUP BY e.nspname, c.relkind
    UNION ALL
    SELECT e.nspname, 'rotina_' || p.prokind::text, count(*)
      FROM pg_proc p JOIN esquemas e ON e.oid = p.pronamespace
     GROUP BY e.nspname, p.prokind
    UNION ALL
    SELECT e.nspname, 'restricao', count(*)
      FROM pg_constraint k JOIN esquemas e ON e.oid = k.connamespace
     GROUP BY e.nspname
    UNION ALL
    SELECT e.nspname, 'gatilho', count(*)
      FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN esquemas e ON e.oid = c.relnamespace
     WHERE NOT g.tgisinternal
     GROUP BY e.nspname
),
linhas AS (
    SELECT e.nspname, 'linhas:' || c.relname AS tipo,
           (xpath('/row/n/text()',
                  query_to_xml(format('SELECT count(*) AS n FROM %I.%I', e.nspname, c.relname), false, true, '')))[1]::text::bigint AS n
      FROM pg_class c JOIN esquemas e ON e.oid = c.relnamespace
     WHERE c.relkind = 'r'
),
definicoes AS (
    SELECT e.nspname, 'md5_definicoes' AS tipo,
           ('x' || substr(md5(string_agg(d.def, '|' ORDER BY d.def)), 1, 15))::bit(60)::bigint AS n
      FROM esquemas e
      JOIN LATERAL (
            SELECT pg_get_viewdef(c.oid) AS def FROM pg_class c WHERE c.relnamespace = e.oid AND c.relkind = 'v'
            UNION ALL SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.pronamespace = e.oid
            UNION ALL SELECT k.conname || pg_get_constraintdef(k.oid) FROM pg_constraint k WHERE k.connamespace = e.oid
            UNION ALL SELECT pg_get_triggerdef(g.oid) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
                       WHERE c.relnamespace = e.oid AND NOT g.tgisinternal
           ) d ON true
     GROUP BY e.nspname
)
SELECT nspname || ' ' || tipo || ' = ' || n
  FROM (SELECT * FROM objetos UNION ALL SELECT * FROM linhas UNION ALL SELECT * FROM definicoes) t
 ORDER BY 1;

ROLLBACK;
