# Catálogo de indicadores — ambiente demonstrativo

> Todos os valores calculados na fase 1 são **SINTÉTICOS** e não representam resultados reais da empresa.

**Convenções:**
- Período = o filtro de `dim_data` aplicado no relatório.
- Quantidades em **peças**. Valores em **R$**.
- Peso (g) nunca é somado a peças.
- Medidas comerciais vêm de `fato_venda_item`; medidas físicas vêm de `fato_movimentacao_estoque` e `fato_snapshot_estoque`.

## Indicadores da fase 1

| Indicador | Fórmula | Unidade | Período | Fato | Limitações |
|---|---|---|---|---|---|
| Saldo atual | Σ `quantidade_em_estoque` no **último** snapshot dentro do período | peças | data de referência mais recente do filtro | snapshot | Semiaditivo: não somar ao longo do tempo; granularidade mensal |
| Peso em estoque (Ouro) | Σ (`quantidade_em_estoque` × `peso_g`) para Ouro, no último snapshot | g | idem | snapshot + dim_produto | Somente Ouro; não misturar com peças |
| Entradas | Σ `quantidade` dos tipos com sinal +1 (por tipo, se desejado) | peças | filtro | movimentação | Separar `SALDO_INICIAL` de `ENTRADA_COMPRA` |
| Saídas | Σ `quantidade` dos tipos com sinal −1, por tipo | peças | filtro | movimentação | Saída ≠ venda; presente e roubo aparecem à parte |
| Saldo líquido movimentado | Σ (`quantidade` × `sinal`) | peças | filtro | movimentação | É variação, não saldo |
| Quantidade comprada | Σ `quantidade_recebida` | peças | filtro | compra | — |
| Custo total de aquisição | Σ `custo_total_pago` | R$ | filtro | compra | Custo sintético |
| Custo médio ponderado de aquisição | Σ `custo_total_pago` ÷ Σ `quantidade_recebida` | R$/peça | filtro | compra | Média dos custos de compra ponderada pela quantidade adquirida. **Não** é CMV nem valorização contábil do estoque |
| Preço sugerido médio | Média de `preco_sugerido_unitario` ponderada por `quantidade_recebida` | R$/peça | filtro | compra | Apenas Ouro/Prata |
| Unidades vendidas | Σ `quantidade_vendida` | peças | filtro | venda | — |
| Faturamento realizado | Σ `valor_realizado_total` | R$ | filtro | venda | Exclui presentes, roubos e ajustes |
| Valor marcado vendido | Σ `valor_marcado_total` | R$ | filtro | venda | Não é faturamento |
| Diferença marcado × realizado | Σ `diferenca_marcado_realizado`; em %: ÷ Σ `valor_marcado_total` | R$ e % | filtro | venda | Positiva = desconto; negativa = venda acima do marcado; cenários sintéticos |
| Nº de vendas (sim.) | DISTINCTCOUNT(`id_venda_sintetica`) | vendas | filtro | venda | **Somente na simulação**; a fonte real não tem ID de venda |
| Ticket médio por venda (sim.) | Faturamento realizado ÷ Nº de vendas | R$/venda | filtro | venda | Idem |
| Itens por venda (sim.) | Unidades vendidas ÷ Nº de vendas | peças/venda | filtro | venda | Idem |
| Variação % vs. período anterior | (atual − anterior) ÷ anterior × 100 | % | período comparável do ano anterior | qualquer fato aditivo | Vazio se o anterior for zero ou inexistente |
| Produtos sem venda | Nº de produtos com estoque e sem venda no período | produtos | filtro | venda + snapshot | Definição configurável (período sem venda) |
| Dias desde a última venda | data final do filtro − data da última venda do produto | dias | até a data final | venda | Vazio para produtos nunca vendidos |
| Ranking de movimentação | Ordenação por unidades vendidas (vendas) ou por saídas totais (movimentação) | posição | filtro | venda / movimentação | O visual deve indicar qual base é usada |
| Suporte do par A,B (sim.) | vendas com A e B ÷ total de vendas | % | filtro | venda (`vw_associacao_pares`) | Padrão de afinidade **inserido** na simulação |
| Confiança A→B (sim.) | vendas com A e B ÷ vendas com A | % | filtro | idem | Idem |
| Lift A→B (sim.) | confiança A→B ÷ suporte de B | razão | filtro | idem | Idem |

## Fora da fase 1 (dependem de política de valorização ou de dados inexistentes)

| Indicador | Motivo |
|---|---|
| Margem bruta | Exige política de valorização e CMV |
| Estoque valorizado | Exige política de valorização |
| Giro por custo | Exige estoque médio valorizado e CMV |
| Ticket e gasto por cliente | Clientes fora do escopo |
| Previsão de demanda | Não é requisito confirmado |

Na fase real, ticket médio, número de vendas e associação **só** poderão ser usados quando o sistema operacional registrar um identificador único de venda.
