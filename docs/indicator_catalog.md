# Catálogo de indicadores

Os indicadores abaixo são candidatos. A implementação depende da inspeção das fontes e da validação de fórmulas e regras com o parceiro.

| Indicador | Dependência mínima | Situação atual |
|---|---|---|
| Saldo atual por produto | Fonte de quantidade disponível e identificação de produto | Fonte XLSX informada; ainda não inspecionada |
| Estoque por classificação | Classificação consistente de produto | A confirmar nas fontes |
| Evolução do estoque | Snapshots em datas diferentes ou eventos confiáveis | Histórico desconhecido |
| Compras por produto/período | Fonte de compras, datas, produto, quantidade e semântica do custo | Fonte informada; ainda não inspecionada |
| Unidades vendidas por produto/período | Fonte de vendas com produto, data e quantidade interpretáveis | Fonte informada; ainda não inspecionada |
| Faturamento bruto | Semântica confirmada de preço e quantidade e regra de venda válida | Pendente de inspeção |
| Produtos sem movimentação | Histórico suficiente e definição de movimentação relevante | Histórico desconhecido |
| Sazonalidade | Histórico temporal suficiente e comparável | Não confirmado |
| Giro tradicional | Estoque médio valorizado e custo das mercadorias vendidas, conforme fórmula | Não confirmado |
| Margem bruta | Política de valorização e associação entre custos e vendas | Não confirmado |
| Ticket médio por transação | Identificação confiável de transações válidas | Não disponível segundo informação atual |
| Ticket/gasto por cliente | Identificação de clientes e compras associadas | Não confirmado |
| Associação de produtos comprados juntos | Identificador confiável de transação que agrupe itens | Não disponível segundo informação atual |

Para cada indicador implementado, documentar objetivo, fórmula, unidade, período, fato/dimensões, granularidade, filtros e limitações. Não apresentar candidatos condicionais como indicadores implementados.
