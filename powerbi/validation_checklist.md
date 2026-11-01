# Checklist de validação do Power BI contra o DW

**Status:** não executado (o Power BI Desktop ainda não está instalado).

**Procedimento:**
1. Rode cada consulta abaixo no `psql`, de preferência dentro de uma transação somente leitura.
2. Compare o resultado com o visual indicado, sem filtros (exceto quando especificado).
3. Registre aqui a data, a execução (`id_execucao`) e o resultado de cada item.

## Pré-condições
- [ ] `scripts/run_demo_etl.ps1` terminou com SUCESSO.
- [ ] `scripts/run_tests.ps1 -ComReexecucao` passou.
- [ ] O aviso "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA." aparece em **todas** as páginas.
- [ ] O parâmetro `Esquema` está igual a `bi_demo`.
- [ ] Não há relacionamento entre tabelas fato.

## Conferências numéricas

| # | Indicador (visual) | Consulta SQL de referência | Resultado SQL | Resultado Power BI | OK? |
|---|---|---|---|---|---|
| 1 | Saldo Atual (peças), sem filtro | `SELECT sum(quantidade_em_estoque) FROM bi_demo.vw_fato_snapshot_estoque s JOIN bi_demo.vw_dim_data d USING (data_key) WHERE d.data = (SELECT max(data) FROM bi_demo.vw_dim_data d2 JOIN bi_demo.vw_fato_snapshot_estoque s2 USING (data_key));` | | | |
| 2 | Saldo Atual por material | idem, com `JOIN bi_demo.vw_dim_produto USING (produto_key) GROUP BY material` | | | |
| 3 | Peso em Estoque Ouro (g) | idem #1 com `sum(quantidade_em_estoque * peso_g)` e `material = 'Ouro'` | | | |
| 4 | Entradas (peças) | `SELECT sum(quantidade) FROM bi_demo.vw_fato_movimentacao_estoque m JOIN bi_demo.vw_dim_tipo_movimentacao t USING (tipo_mov_key) WHERE t.sinal = 1;` | | | |
| 5 | Saídas por tipo | idem com `t.sinal = -1 GROUP BY t.codigo_tipo` | | | |
| 6 | Saldo líquido = último saldo | `SELECT sum(m.quantidade * t.sinal) FROM bi_demo.vw_fato_movimentacao_estoque m JOIN bi_demo.vw_dim_tipo_movimentacao t USING (tipo_mov_key);` deve ser igual ao #1 | | | |
| 7 | Quantidade Comprada | `SELECT sum(quantidade_recebida) FROM bi_demo.vw_fato_compra_item;` | | | |
| 8 | Custo Total de Aquisição | `SELECT sum(custo_total_pago) FROM bi_demo.vw_fato_compra_item;` | | | |
| 9 | Custo Médio Ponderado de Aquisição | `SELECT sum(custo_total_pago) / sum(quantidade_recebida) FROM bi_demo.vw_fato_compra_item;` | | | |
| 10 | Unidades Vendidas | `SELECT sum(quantidade_vendida) FROM bi_demo.vw_fato_venda_item;` | | | |
| 11 | Faturamento Realizado | `SELECT sum(valor_realizado_total) FROM bi_demo.vw_fato_venda_item;` | | | |
| 12 | Diferença Marcado x Realizado (R$) | `SELECT sum(diferenca_marcado_realizado) FROM bi_demo.vw_fato_venda_item;` | | | |
| 13 | Número de Vendas (sim.) | `SELECT count(DISTINCT id_venda_sintetica) FROM bi_demo.vw_fato_venda_item;` | | | |
| 14 | Ticket Médio (sim.) | #11 ÷ #13 | | | |
| 15 | Faturamento por ano | `SELECT d.ano, sum(valor_realizado_total) FROM bi_demo.vw_fato_venda_item v JOIN bi_demo.vw_dim_data d USING (data_key) GROUP BY d.ano ORDER BY 1;` | | | |
| 16 | Variação a/a do último ano | a partir do #15: (ano2 − ano1) ÷ ano1 | | | |
| 17 | Faturamento nas janelas comerciais | `SELECT d.janela_comercial, sum(valor_realizado_total) FROM bi_demo.vw_fato_venda_item v JOIN bi_demo.vw_dim_data d USING (data_key) GROUP BY 1;` | | | |
| 18 | Produtos sem venda no período completo | `SELECT count(*) FROM bi_demo.vw_dim_produto p WHERE NOT EXISTS (SELECT 1 FROM bi_demo.vw_fato_venda_item v WHERE v.produto_key = p.produto_key);` (comparar considerando o filtro de saldo > 0 da medida) | | | |
| 19 | Top 3 pares por lift | `SELECT antecedente, consequente, suporte, confianca, lift FROM bi_demo.vw_associacao_tipos ORDER BY lift DESC LIMIT 3;` | | | |
| 20 | Presentes + roubos sem faturamento | `SELECT count(*) FROM bi_demo.vw_fato_venda_item v JOIN bi_demo.vw_fato_movimentacao_estoque m USING (id_evento_origem) JOIN bi_demo.vw_dim_tipo_movimentacao t ON t.tipo_mov_key = m.tipo_mov_key WHERE NOT t.eh_venda;` deve ser 0 | | | |

## Conferências qualitativas
- [ ] Nenhum visual soma `quantidade_em_estoque` ao longo do tempo.
- [ ] Nenhum visual soma peso com peças.
- [ ] O faturamento usa `valor_realizado_total`, nunca o valor marcado.
- [ ] A página 9 informa que os IDs e as afinidades são sintéticos.
- [ ] A página 8 informa que a sazonalidade foi inserida na simulação.
- [ ] Não há visual de clientes, margem, estoque valorizado ou giro por custo.
