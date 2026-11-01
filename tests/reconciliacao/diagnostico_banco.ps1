# Diagnostico somente leitura do PostgreSQL (dw_joalheria). Nao altera nada (READ ONLY + ROLLBACK).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
\echo == servidor / banco / usuario
SELECT version(), current_database(), current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser;
\echo == esquemas e objetos
SELECT n.nspname AS esquema,
       count(*) FILTER (WHERE c.relkind = 'r') AS tabelas,
       count(*) FILTER (WHERE c.relkind = 'v') AS views,
       count(*) FILTER (WHERE c.relkind = 'm') AS mviews
FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace = n.oid
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
GROUP BY n.nspname ORDER BY 1;
\echo == funcoes por esquema
SELECT n.nspname, count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname LIKE '%_demo' GROUP BY 1 ORDER BY 1;
\echo == linhas por tabela dw_demo e staging_demo (estimativa exata via count)
SELECT 'dw_demo.dim_data', count(*) FROM dw_demo.dim_data
UNION ALL SELECT 'dw_demo.dim_produto', count(*) FROM dw_demo.dim_produto
UNION ALL SELECT 'dw_demo.dim_tipo_movimentacao', count(*) FROM dw_demo.dim_tipo_movimentacao
UNION ALL SELECT 'dw_demo.parametro_preco_ouro', count(*) FROM dw_demo.parametro_preco_ouro
UNION ALL SELECT 'dw_demo.fato_venda_item', count(*) FROM dw_demo.fato_venda_item
UNION ALL SELECT 'dw_demo.fato_compra_item', count(*) FROM dw_demo.fato_compra_item
UNION ALL SELECT 'dw_demo.fato_movimentacao_estoque', count(*) FROM dw_demo.fato_movimentacao_estoque
UNION ALL SELECT 'dw_demo.fato_snapshot_estoque', count(*) FROM dw_demo.fato_snapshot_estoque;
\echo == tabelas staging_demo com linhas
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'staging_demo' ORDER BY 1;
\echo == views bi_demo
SELECT table_name FROM information_schema.views WHERE table_schema = 'bi_demo' ORDER BY 1;
\echo == execucoes de auditoria
SELECT id_execucao, status, iniciado_em, finalizado_em, left(coalesce(mensagem,''), 80) AS mensagem FROM audit_demo.execucao ORDER BY id_execucao;
\echo == verificacoes da ultima execucao
SELECT count(*) AS total, count(*) FILTER (WHERE aprovado) AS aprovadas, count(*) FILTER (WHERE NOT aprovado) AS reprovadas
FROM audit_demo.resultado_validacao WHERE id_execucao = (SELECT max(id_execucao) FROM audit_demo.execucao);
SELECT codigo, aprovado FROM audit_demo.resultado_validacao WHERE id_execucao = (SELECT max(id_execucao) FROM audit_demo.execucao) AND NOT aprovado;
\echo == rejeicoes por execucao
SELECT id_execucao, count(*) FROM audit_demo.rejeicao GROUP BY 1 ORDER BY 1;
\echo == migrations registradas
SELECT count(*) AS arquivos, min(aplicado_em), max(aplicado_em) FROM audit_demo.migracao_aplicada;
\echo == origem_dado no DW
SELECT 'venda', origem_dado, count(*) FROM dw_demo.fato_venda_item GROUP BY 2
UNION ALL SELECT 'produto', origem_dado, count(*) FROM dw_demo.dim_produto GROUP BY 2;
\echo == esquemas reais (nao devem existir)
SELECT nspname FROM pg_namespace WHERE nspname IN ('staging','dw','bi','audit');
\echo == papeis de leitura
SELECT rolname, rolcanlogin, rolsuper FROM pg_roles WHERE rolname ILIKE '%leitura%' OR rolname ILIKE '%bi%';
\echo == privilegios bi_leitura em bi_demo e dw_demo
SELECT grantee, table_schema, privilege_type, count(*) FROM information_schema.role_table_grants
WHERE grantee ILIKE '%leitura%' GROUP BY 1,2,3 ORDER BY 1,2,3;
\echo == conexoes ativas por usuario/aplicacao
SELECT usename, application_name, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1,2 ORDER BY 3 DESC;
ROLLBACK;
'@
Invoke-Psql -Comando $sql
