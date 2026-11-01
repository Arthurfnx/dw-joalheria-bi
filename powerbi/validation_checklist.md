# Checklist de validação do Power BI contra o DW

**Status:** executado. Base: execução 3 de `audit_demo.execucao`, período completo (01/01/2024 a 31/12/2025), sem filtros.

**Como foi feito:**
- **Lado SQL:** as consultas abaixo foram executadas em 2026-11-01, em `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`. As conferências por página estão em `tests/reconciliacao/`.
- **Lado Power BI:** durante a construção de cada página (2026-11-01), as medidas foram avaliadas com consultas DAX pelo Power BI Modeling MCP e comparadas manualmente com o SQL. A comparação não é automatizada.
- **"Conferido"** = o valor DAX coincidiu com o SQL durante a construção. **"Não conferido no Power BI"** = só o lado SQL foi registrado; falta comparar com o visual.

## Pré-condições
- [x] `scripts/run_demo_etl.ps1` terminou com SUCESSO (execuções 2 e 3).
- [x] `scripts/run_tests.ps1 -ComReexecucao` passou (execução 3: 24/24, REP-01 e REP-02).
- [x] O aviso "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA." aparece nas seis páginas principais (conferido no PBIR).
- [x] Conexão fixa em `localhost:5432`, banco `dw_joalheria`, esquema `bi_demo` (não há parâmetro; ver `powerbi/connection_guide.md`).
- [x] Não há relacionamento entre tabelas fato (conferido em `relationships.tmdl`).

## Conferências numéricas

| # | Indicador | Resultado SQL | Medida / visual | Situação |
|---|---|---|---|---|
| 1 | Estoque atual (peças), sem filtro | 520 (31/12/2025) | `[Estoque Atual (Peças)]` | Conferido |
| 2 | Estoque atual por material | Folheado 223; Ouro 97; Prata 200 | "Estoque por material" (páginas 1 e 2) | Não conferido no Power BI (a soma, 520, foi conferida) |
| 3 | Peso em estoque Ouro (g) | 410,345 | `[Peso em Estoque Ouro (g)]` | Conferido |
| 4 | Entradas (peças) | 7.380 | `[Entradas de Estoque (Peças)]` | Conferido |
| 5 | Saídas por tipo | venda 6.819; presente 20; ajuste negativo 21 | cartões da página 5 | Conferido |
| 6 | Saldo líquido = último saldo | 520 = #1 | `[Saldo Líquido Movimentado]` | Conferido |
| 7 | Quantidade adquirida | 6.773 | `[Quantidade Adquirida]` | Conferido |
| 8 | Custo total das compras | R$ 3.995.958,71 | `[Custo Total das Compras]` | Conferido |
| 9 | Custo médio ponderado de aquisição | R$ 589,98 | `[Custo Médio Ponderado de Aquisição]` | Conferido |
| 10 | Quantidade vendida | 6.819 | `[Quantidade Vendida]` | Conferido |
| 11 | Receita realizada | R$ 6.701.258,34 | `[Receita Realizada]` | Conferido |
| 12 | Diferença marcado × realizado | R$ 238.156,66 (desconto de 3,43% sobre o valor marcado) | `[Desconto sobre Valor Marcado (%)]` | Conferido (percentual) |
| 13 | Número de vendas (sintético) | 4.415 | `[Número de Vendas]` | Conferido |
| 14 | Ticket médio (sintético) | R$ 1.517,84 | `[Ticket Médio]` | Conferido |
| 15 | Receita por ano | 2024: R$ 3.166.042,46; 2025: R$ 3.535.215,88 | segmentação Ano | Não conferido no Power BI |
| 16 | Variação a/a | +11,66% (calculada a partir do #15) | — | Não há medida a/a no modelo |
| 17 | Receita por janela comercial | Natal R$ 825.841,68; Dia das Mães R$ 234.952,75; Dia dos Namorados R$ 171.120,07; Black Friday R$ 129.840,32; demais datas R$ 5.339.503,52 | tabela "Janelas comerciais" (página 6) | Conferido (`conferir_janelas_comerciais.ps1`) |
| 18 | Produtos sem venda no período completo | 15 (também 15 com o filtro de estoque > 0 da medida) | `[Produtos sem Venda no Período]` | Conferido |
| 19 | Top 3 regras de tipos por lift | Pingente → Corrente 2,748333; Corrente → Pingente 2,748333; Cordão → Pingente 1,344022 | "Associação entre tipos de peça" | Não conferido no Power BI (o total de 90 regras foi conferido) |
| 20 | Presentes e roubos sem receita | 0 itens de venda ligados a movimentos não comerciais | — | Verificação estrutural, só SQL |

Conferências adicionais da página 6 (`conferir_sazonalidade_associacao.ps1`, conferidas com o Power BI): média diária R$ 15.834,36 nas janelas × R$ 8.278,30 nas demais datas (+91,3%); 3.396 regras de produtos, 52 com ≥ 5 vendas conjuntas; 10º lift do ranking 7,178862.

## Conferências qualitativas
- [x] Nenhum visual soma `quantidade_em_estoque` ao longo do tempo (as medidas de estoque usam o último snapshot).
- [x] Nenhum visual soma peso com peças.
- [x] A receita usa `valor_realizado_total`, nunca o valor marcado.
- [x] A página 6 informa que IDs, sazonalidade e afinidades são sintéticos e que a associação não responde aos filtros.
- [x] Não há visual de clientes, margem, estoque valorizado ou giro por custo.

## Pendências de validação
- Comparar no Power BI os itens #2, #15 e #19.
- Os valores acima valem para a configuração e o ETL atuais; qualquer mudança exige nova conferência.
