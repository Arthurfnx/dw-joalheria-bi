# Catálogo de indicadores

Este catálogo tem duas partes:

- **Indicadores reais** (solução em produção, dados reais da joalheria): as 7 seções de indicadores lidas do Data Warehouse e os 3 indicadores da tela Indicadores do sistema.
- **Ambiente demonstrativo (histórico):** os indicadores da fase 1, calculados sobre dados sintéticos no relatório Power BI demonstrativo. Mantidos abaixo, sem alteração.

## Indicadores reais

### Convenções

- **Onde aparecem:**
  - **Relatórios** = tela Relatórios do sistema, seção "Gráficos e filtros", lida do DW (views do esquema `bi`, papel `bi_leitura`), com filtros de Material, Tipo de peça e Ano;
  - **Grafana** = painel do Grafana Cloud, com as mesmas 7 seções: o painel público (sem filtros) e o painel completo (com os mesmos filtros, para quem tem login);
  - **Indicadores** = tela Indicadores do sistema, lida do banco operacional.
- As fórmulas estão no cabeçalho de cada consulta em `tools/grafana/consultas/*.sql`; a tela Relatórios aplica as mesmas regras.
- **Período:** salvo indicação, todo o histórico de vendas carregado no DW (vendas importadas das planilhas e vendas confirmadas no sistema). O filtro Ano restringe as vendas.
- **"Hoje"** = data de referência da última carga do DW (dia do último retrato do estoque), exibida no cabeçalho dos painéis.
- **Receita** = Σ `valor_faturado` de `fato_venda_item`. Vendas de valor simbólico (R$ 0,01) e vendas sem valor contam como peças vendidas, mas não como receita. Vendas canceladas não entram no DW.
- **Unidades:** peças (quantidade), R$ (reais), dias e %. Peças e reais nunca dividem o mesmo gráfico ou eixo; preço unitário nunca é somado; peso não entra em nenhum indicador.
- **Estoque** vem do último retrato diário (`fato_snapshot_estoque`) e nunca é somado ao longo do tempo.
- Nenhum indicador mostra nome de pessoa.

### Seções dos painéis (Relatórios e Grafana)

| Seção | Pergunta de negócio | Indicador | Fórmula | Unidade | Período | Onde aparece | Limitações |
|---|---|---|---|---|---|---|---|
| Cabeçalho | Até quando vão os dados? | Data de referência e status da carga | Data e status da última execução do ETL (`bi.vw_info_ambiente`) | data | última carga | Relatórios, Grafana | Dados novos do sistema só aparecem depois do ETL |
| 1. Vendas por período | Quanto a loja faturou? | Receita faturada | Σ `valor_faturado` | R$ | histórico completo (ou anos filtrados) | Relatórios, Grafana | Exclui vendas simbólicas e sem valor |
| 1. Vendas por período | Quantas peças saíram por venda? | Peças vendidas | Σ `quantidade_vendida` | peças | idem | Relatórios, Grafana | Inclui vendas simbólicas e sem valor |
| 1. Vendas por período | Quantas peças saíram sem gerar receita? | Peças vendidas sem receita | Σ `quantidade_vendida` onde `entra_faturamento` é falso | peças | idem | Relatórios, Grafana | — |
| 1. Vendas por período | Como a receita evolui mês a mês? | Receita por mês | Σ `valor_faturado` por mês da venda; meses sem venda = 0 | R$ | do primeiro ao último mês com venda | Relatórios, Grafana | Cerca de 110 vendas em dois anos: oscilações grandes entre meses |
| 1. Vendas por período | Como as peças vendidas evoluem mês a mês? | Peças vendidas por mês | Σ `quantidade_vendida` por mês da venda; meses sem venda = 0 | peças | idem | Relatórios, Grafana | Idem |
| 2. Tipos vendidos | Quais tipos de peça vendem mais? | Peças vendidas por tipo de peça | Σ `quantidade_vendida` por `tipo_peca` | peças | histórico completo (ou anos filtrados) | Relatórios, Grafana | Tipo de peça = categoria do cadastro |
| 2. Tipos vendidos | Quais tipos trazem mais receita? | Receita por tipo de peça | Σ `valor_faturado` por `tipo_peca` | R$ | idem | Relatórios, Grafana | — |
| 2. Tipos vendidos | Qual material vende mais? | Vendas por material | Peças = Σ `quantidade_vendida`; Receita = Σ `valor_faturado`; % das peças = peças do material ÷ total de peças vendidas | peças, R$ e % | idem | Relatórios, Grafana | O ouro não tem venda registrada no histórico |
| 3. Taxa de venda e tempo até a venda | Que parte do que entrou já foi vendida? | Taxa de venda, por tipo de peça e por material | peças vendidas ÷ (peças vendidas + peças em estoque hoje) | % | vendas do histórico completo; estoque de hoje | Relatórios, Grafana | **Não é giro de estoque tradicional** (exige custo das vendas e estoque médio valorizado) |
| 3. Taxa de venda e tempo até a venda | Quanto tempo uma peça leva para ser vendida? | Tempo até a venda (média e mediana), por tipo e por material | data da venda − `data_aquisicao` do produto; média e mediana | dias | vendas do histórico completo | Relatórios, Grafana | Só vendas de produtos com data de aquisição (coluna "Amostra"); vendas com aquisição posterior à venda ficam fora |
| 4. Produtos parados | Quais peças estão paradas há mais tempo? | Dias parado, por produto, os mais antigos primeiro | data de referência − `data_aquisicao`, para cada peça com saldo > 0; hierarquia Material › Tipo de peça › Produto | dias e peças | estoque de hoje | Relatórios, Grafana | Peças sem data de aquisição não recebem data estimada |
| 4. Produtos parados | Quanto do estoque não tem data de aquisição? | Peças em estoque sem data de aquisição | Σ `quantidade_em_estoque` das peças sem `data_aquisicao`, por material e tipo | peças | estoque de hoje | Relatórios, Grafana | Todo o ouro e boa parte do folheado estão nessa situação |
| 5. Tipo que mais fica parado | Que tipo de peça encalha? | Mediana e média de dias parado por tipo; % acima de 180 dias | dias parado das peças em estoque com data; % = peças com mais de 180 dias ÷ peças com data | dias, peças e % | estoque de hoje | Relatórios, Grafana | Mesma restrição de data de aquisição; "Sem data" mostra as peças fora do cálculo |
| 6. Sazonalidade | Em que meses do ano a loja vende mais? | Peças vendidas por mês do ano | Σ `quantidade_vendida` por mês do ano (jan a dez), somando os anos | peças | histórico completo (ou anos filtrados) | Relatórios, Grafana | Cerca de 110 vendas em dois anos: padrão indicativo; meses cobertos por dois anos pesam mais |
| 6. Sazonalidade | Em que meses do ano a receita é maior? | Receita por mês do ano | Σ `valor_faturado` por mês do ano | R$ | idem | Relatórios, Grafana | Idem |
| 7. Reposição | O que precisa ser reposto? | Cobertura do estoque, por material e tipo de peça | estoque atual ÷ (peças vendidas nos 12 meses anteriores à data de referência ÷ 12); sinal "repor" quando a cobertura é menor que 3 meses | meses e peças | estoque de hoje; vendas dos últimos 12 meses | Relatórios, Grafana | **Proposta, a confirmar com o proprietário** (regra dos 3 meses). Sem vendas em 12 meses, a cobertura fica indefinida. O filtro Ano não se aplica |

Nos produtos parados, no tipo mais parado e na reposição, o filtro Ano não se aplica: são o estoque de hoje.

### Tela Indicadores do sistema

Lida do banco operacional (não depende do ETL). Cada indicador abre no formato recomendado e o usuário pode trocar o formato; a tabela está sempre disponível. Administrador e Vendedor veem a tela; nenhum indicador mostra custo.

| Pergunta de negócio | Indicador | Fórmula | Unidade | Período | Formatos (recomendado) | Limitações |
|---|---|---|---|---|---|---|
| Como as vendas evoluem? | Vendas por mês | Peças: Σ quantidade vendida por mês; ou Valor: Σ valor das vendas com valor, por mês. Junta vendas confirmadas do sistema e histórico importado das planilhas | peças ou R$ (escolha do usuário) | últimos 24 meses; meses sem venda = 0 | Linha (recomendado), Barras, Tabela | Simbólicas e sem valor contam só na quantidade; canceladas não entram |
| Como o estoque se divide por categoria? | Estoque por categoria | Σ saldo dos produtos ativos, por categoria | peças | saldo atual | Barras (recomendado com mais de 5 categorias), Rosca (com até 5), Tabela | — |
| Como o estoque se divide por material? | Estoque por material | Σ saldo dos produtos ativos, por material | peças | saldo atual | Rosca (recomendado com até 5 materiais), Barras (com mais de 5), Tabela, Cartões | — |

### Indicadores retirados e não calculados

| Indicador | Situação | Motivo |
|---|---|---|
| Número de vendas | Retirado dos painéis | Exige identificador de transação. As vendas históricas das planilhas não têm número de venda; só as vendas registradas no sistema têm, e ainda não há vendas do sistema no DW |
| Ticket médio por venda | Retirado dos painéis | Receita ÷ número de vendas: depende do mesmo identificador |
| Associação entre produtos (suporte, confiança, lift) | Retirado dos painéis | Depende de saber quais itens saíram na mesma venda. As views `bi.vw_associacao_tipos` e `bi.vw_associacao_produtos` existem no DW e usam só vendas do sistema; os indicadores voltam aos painéis quando houver vendas suficientes registradas no sistema |
| Margem bruta, custo das mercadorias vendidas, estoque valorizado, giro por custo | Não calculados | Exigem política de valorização de estoque, ainda não definida pela empresa |
| Ticket e gasto por cliente | Não calculados | Cadastro de clientes fora do escopo; nomes de clientes não são importados |
| Previsão de demanda | Não calculada | Não é requisito confirmado; o histórico é curto |

---

# Ambiente demonstrativo (histórico)


> Todos os valores calculados na fase 1 são **SINTÉTICOS** e não representam resultados reais da empresa.

**Convenções:**
- Período = o filtro de `dim_data` aplicado no relatório.
- Quantidades em **peças**. Valores em **R$**.
- Peso (g) nunca é somado a peças.
- Medidas comerciais vêm de `fato_venda_item`; medidas físicas vêm de `fato_movimentacao_estoque` e `fato_snapshot_estoque`.

## Indicadores da fase 1 (ambiente demonstrativo)

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
| Suporte do par A,B (sim.) | vendas com A e B ÷ total de vendas | % | histórico completo (não responde a filtros, D-035) | venda (`vw_associacao_produtos`, `vw_associacao_tipos`) | Padrão de afinidade **inserido** na simulação |
| Confiança A→B (sim.) | vendas com A e B ÷ vendas com A | % | idem | idem | Idem |
| Lift A→B (sim.) | confiança A→B ÷ suporte de B | razão | idem | idem | Idem; o ranking de produtos exige ≥ 5 vendas conjuntas (D-039) |
| Receita média diária: janelas × demais datas | receita do grupo ÷ dias de calendário do grupo; diferença = janelas ÷ demais − 1 | R$/dia e % | filtro | venda + dim_data | A sazonalidade foi **inserida** na simulação (D-040) |

## Situação no relatório Power BI (2026-11-01)

| Indicador | Situação | Medida |
|---|---|---|
| Saldo atual | Implementado | `[Estoque Atual (Peças)]` |
| Peso em estoque (Ouro) | Implementado | `[Peso em Estoque Ouro (g)]` |
| Entradas, saídas e saldo líquido | Implementado | `[Entradas de Estoque (Peças)]`, `[Saídas de Estoque (Peças)]`, medidas por tipo, `[Saldo Líquido Movimentado]` |
| Quantidade comprada, custo total, custo médio ponderado | Implementado | `[Quantidade Adquirida]`, `[Custo Total das Compras]`, `[Custo Médio Ponderado de Aquisição]` |
| Preço sugerido médio | **Não implementado** (planejado) | — |
| Unidades vendidas, faturamento, valor marcado | Implementado | `[Quantidade Vendida]`, `[Receita Realizada]`, `[Valor Marcado Vendido]` |
| Diferença marcado × realizado | Implementado em % | `[Desconto sobre Valor Marcado (%)]`; preços médios em `[Preço Médio Marcado]` e `[Preço Médio Realizado]` |
| Nº de vendas e ticket médio (sim.) | Implementado | `[Número de Vendas]`, `[Ticket Médio]` |
| Itens por venda (sim.) | **Não implementado** (planejado) | — |
| Variação % vs. período anterior | **Não implementado** (planejado); a comparação é feita pela segmentação de Ano | — |
| Produtos sem venda | Implementado | `[Produtos sem Venda no Período]` |
| Dias desde a última venda | **Não implementado** (planejado) | — |
| Ranking de movimentação | Implementado como Top 10 por receita, custo e estoque (D-041) | medidas "… - Top 10 …" |
| Suporte, confiança, lift | Implementado | medidas da pasta "05 - Análises temporais\Associações" |
| Receita média diária: janelas × demais datas | Implementado | `[Receita Média Diária - Janelas Comerciais]`, `[Receita Média Diária - Demais Datas]`, `[Diferença da Média Diária - Janelas vs Demais]` |

## Fora da fase 1 (dependem de política de valorização ou de dados inexistentes)

| Indicador | Motivo |
|---|---|
| Margem bruta | Exige política de valorização e CMV |
| Estoque valorizado | Exige política de valorização |
| Giro por custo | Exige estoque médio valorizado e CMV |
| Ticket e gasto por cliente | Clientes fora do escopo |
| Previsão de demanda | Não é requisito confirmado |

Na solução real, ticket médio, número de vendas e associação ficaram fora dos painéis (ver "Indicadores retirados e não calculados", acima).
