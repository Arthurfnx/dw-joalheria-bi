# Conferencia somente leitura da pagina 6 (sazonalidade e associacao) contra o PostgreSQL (bi_demo).
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$sql = @'
BEGIN TRANSACTION READ ONLY;
WITH v AS (SELECT v.valor_realizado_total, v.quantidade_vendida, d.data, d.ano, d.janela_comercial
           FROM bi_demo.vw_fato_venda_item v JOIN bi_demo.vw_dim_data d USING (data_key)),
     dias AS (SELECT count(*) FILTER (WHERE janela_comercial IS NOT NULL) AS dj,
                     count(*) FILTER (WHERE janela_comercial IS NULL) AS dd FROM bi_demo.vw_dim_data),
     tot AS (SELECT sum(valor_realizado_total) FILTER (WHERE janela_comercial IS NOT NULL) AS rj,
                    sum(valor_realizado_total) FILTER (WHERE janela_comercial IS NULL) AS rd,
                    sum(quantidade_vendida) FILTER (WHERE janela_comercial IS NOT NULL) AS qj FROM v)
SELECT 'janelas_distintas', string_agg(DISTINCT janela_comercial, ', ') FROM bi_demo.vw_dim_data
UNION ALL SELECT 'dias_janela / demais', (SELECT dj || ' / ' || dd FROM dias)
UNION ALL SELECT 'receita_janelas', round((SELECT rj FROM tot)::numeric, 2)::text
UNION ALL SELECT 'pecas_janelas', (SELECT qj FROM tot)::text
UNION ALL SELECT 'media_dia_janelas', round(((SELECT rj FROM tot) / (SELECT dj FROM dias))::numeric, 2)::text
UNION ALL SELECT 'media_dia_demais', round(((SELECT rd FROM tot) / (SELECT dd FROM dias))::numeric, 2)::text
UNION ALL SELECT 'diferenca_pct', round((100 * (((SELECT rj FROM tot) / (SELECT dj FROM dias)) / ((SELECT rd FROM tot) / (SELECT dd FROM dias)) - 1))::numeric, 1)::text
UNION ALL (SELECT 'janela ' || janela_comercial || ' ' || ano, round(sum(valor_realizado_total)::numeric, 2) || ' / ' || sum(quantidade_vendida)
           FROM v WHERE janela_comercial IS NOT NULL GROUP BY janela_comercial, ano ORDER BY sum(valor_realizado_total) DESC LIMIT 3)
UNION ALL SELECT 'regras_produtos', count(*)::text FROM bi_demo.vw_associacao_produtos
UNION ALL SELECT 'regras_produtos_min5', count(*)::text FROM bi_demo.vw_associacao_produtos WHERE vendas_com_ambos >= 5
UNION ALL (SELECT 'top_lift_min5', codigo_antecedente || ' -> ' || codigo_consequente || ' = ' || lift
           FROM bi_demo.vw_associacao_produtos WHERE vendas_com_ambos >= 5 ORDER BY lift DESC, codigo_antecedente LIMIT 3)
UNION ALL SELECT 'decimo_lift_min5', (SELECT a.lift::text FROM bi_demo.vw_associacao_produtos a WHERE a.vendas_com_ambos >= 5 ORDER BY a.lift DESC LIMIT 1 OFFSET 9)
UNION ALL SELECT 'regras_tipos', count(*)::text FROM bi_demo.vw_associacao_tipos
UNION ALL (SELECT 'tipos_top', antecedente || ' -> ' || consequente || ' sup=' || suporte || ' conf=' || confianca || ' lift=' || lift
           FROM bi_demo.vw_associacao_tipos ORDER BY lift DESC, confianca DESC LIMIT 2)
UNION ALL SELECT 'total_vendas_ids', count(DISTINCT id_venda_sintetica)::text FROM bi_demo.vw_fato_venda_item;
ROLLBACK;
'@
Invoke-Psql -Comando $sql -Tuplas
