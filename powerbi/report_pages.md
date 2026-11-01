# Especificação das páginas do relatório (ambiente demonstrativo)

**Em todas as páginas, no topo e em destaque:** um cartão com a medida `[Aviso Ambiente]`, que exibe:

> **AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.**

**Segmentações comuns:**
- Período (`dim_data`: ano, mês);
- Material;
- Tipo de peça.

Cada página traz uma nota de rodapé com fórmula, unidade e limitação dos principais indicadores (ver `docs/indicator_catalog.md`). Status: especificação; **não implementada** (aguardando a instalação do Power BI Desktop pelo usuário).

| # | Página | Visuais | Medidas / campos | Observações obrigatórias |
|---|---|---|---|---|
| 1 | Visão geral do negócio | Cartões; linha mensal de faturamento × unidades; barras por material | Saldo Atual, Faturamento Realizado, Unidades Vendidas, Número de Vendas (sim.), Ticket Médio (sim.), Custo Total de Aquisição | Ticket e nº de vendas usam IDs **sintéticos** |
| 2 | Estoque atual por material e tipo de peça | Matriz material × tipo de peça; barras empilhadas; tabela de produtos | Saldo Atual (peças), Produtos com Estoque, Peso em Estoque Ouro (g) | Saldo = último snapshot do período; peso apenas Ouro e em gramas |
| 3 | Evolução do estoque e movimentações | Linha do saldo por fim de mês; colunas de entradas × saídas por tipo; tabela de eventos | Saldo Atual (por mês), Entradas, Saídas, Saídas Não Comerciais, Ajustes Líquidos | Presentes e roubos aparecem como saída, **sem** faturamento |
| 4 | Compras e custos de aquisição | Colunas mensais de quantidade e custo; dispersão custo × preço sugerido; tabela por entrada | Quantidade Comprada, Custo Total de Aquisição, Custo Médio Ponderado de Aquisição, Preço Sugerido Médio, Preço Marcado Médio na Entrada, Número de Entradas (sim.) | Custo médio ponderado de aquisição ≠ CMV; preço sugerido só Ouro/Prata |
| 5 | Vendas e faturamento | Linha mensal; barras por material e tipo; top N produtos | Faturamento Realizado, Unidades Vendidas, Número de Vendas (sim.), Itens por Venda (sim.) | Faturamento usa o preço **realizado** |
| 6 | Preço marcado × realizado | Barras de diferença em R$ e %; distribuição abaixo/igual/acima; tabela por produto | Valor Marcado Vendido, Faturamento Realizado, Diferença Marcado x Realizado (R$ e %), Itens Vendidos Abaixo/Acima do Marcado | Os cenários são **padrões sintéticos** configurados |
| 7 | Maior e menor movimentação | Ranking (top/bottom N) por unidades vendidas; tabela de produtos sem venda; dias desde a última venda | Unidades Vendidas, Saídas (peças), Produtos sem Venda no Período, Dias desde a Última Venda | Indicar se o ranking usa **vendas** ou **saídas totais** |
| 8 | Comparação entre períodos e datas comerciais | Colunas ano × ano por mês; destaque das janelas comerciais; tabela de variação | Faturamento Ano Anterior, Variação Faturamento a/a, Variação Unidades a/a, `dim_data[janela_comercial]` | A sazonalidade foi **inserida** na simulação (não é comportamento real) |
| 9 | Produtos comprados em conjunto | Matriz de tipos (antecedente × consequente) com lift; tabela de pares com suporte e confiança | `associacao_tipos[suporte]`, `[confianca]`, `[lift]`; `associacao_produtos` | Somente IDs **sintéticos**; afinidades foram **inseridas**; métricas do período completo (não respondem ao filtro de data). Com dados reais, exige um ID de venda gerado pelo sistema operacional |

**Fora do relatório:**
- clientes (fora do escopo);
- margem bruta, estoque valorizado e giro por custo (fora da fase 1);
- previsão de demanda.
