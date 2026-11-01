# Modelo semântico — Power BI (ambiente demonstrativo)

> **AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS.** Estado conferido em 2026-11-01 a partir do TMDL em
> `powerbi/relatorio_joalheria_demo.SemanticModel/definition/` (fonte da verdade).

## Visão geral

| Item | Valor |
|---|---|
| Formato | PBIP (`powerbi/relatorio_joalheria_demo.pbip`), modelo em TMDL |
| Modo de armazenamento | Import |
| Fonte | PostgreSQL `localhost:5432`, banco `dw_joalheria`, esquema `bi_demo` (valores fixos; sem parâmetro) |
| Tabelas | 12 views de `bi_demo` + tabela `Medidas` |
| Medidas | 50, todas na tabela `Medidas`, com descrição; exportadas em `powerbi/measures.dax` |
| Relacionamentos | 10 (9 ativos, 1 inativo) |
| Cultura | pt-BR |
| Data/hora automática | desligada (`__PBI_TimeIntelligenceEnabled = 0`) |
| Medidas implícitas | desencorajadas (`discourageImplicitMeasures`) |

## Tabelas

Os nomes no modelo são os gerados pelo navegador do Power BI (`'bi_demo vw_<view>'`); não foram renomeados.

| Tabela no modelo | View | Tipo | Grão | Em uso nas páginas |
|---|---|---|---|---|
| `bi_demo vw_dim_produto` | `bi_demo.vw_dim_produto` | Dimensão | um produto sintético | Sim |
| `bi_demo vw_dim_data` | `bi_demo.vw_dim_data` | Dimensão, marcada como tabela de datas | um dia | Sim |
| `bi_demo vw_dim_tipo_movimentacao` | `bi_demo.vw_dim_tipo_movimentacao` | Dimensão | um tipo (7 linhas) | Sim |
| `bi_demo vw_fato_compra_item` | `bi_demo.vw_fato_compra_item` | Fato transacional | produto × entrada sintética | Sim |
| `bi_demo vw_fato_venda_item` | `bi_demo.vw_fato_venda_item` | Fato transacional | produto × venda sintética | Sim |
| `bi_demo vw_fato_movimentacao_estoque` | `bi_demo.vw_fato_movimentacao_estoque` | Fato transacional | evento de movimentação | Sim |
| `bi_demo vw_fato_snapshot_estoque` | `bi_demo.vw_fato_snapshot_estoque` | Fato snapshot (semiaditivo) | produto × fim de mês | Sim |
| `bi_demo vw_associacao_produtos` | `bi_demo.vw_associacao_produtos` | Auxiliar pré-agregada (período completo) | regra produto → produto | Sim |
| `bi_demo vw_associacao_tipos` | `bi_demo.vw_associacao_tipos` | Auxiliar pré-agregada (período completo) | regra tipo → tipo | Sim |
| `bi_demo vw_preco_ouro` | `bi_demo.vw_preco_ouro` | Auxiliar | um dia (versão vigente) | Não |
| `bi_demo vw_preco_ouro_versoes` | `bi_demo.vw_preco_ouro_versoes` | Auxiliar | versão do preço | Não |
| `bi_demo vw_info_ambiente` | `bi_demo.vw_info_ambiente` | Auxiliar | 1 linha (metadados do ambiente) | Não (o aviso das páginas é texto fixo) |
| `Medidas` | — | Tabela de medidas | — | Sim |

## Relacionamentos

Todos são N:1 do fato para a dimensão, com filtro em direção única, exceto o inativo.

| De (N) | Para (1) | Ativo |
|---|---|---|
| `vw_fato_compra_item[data_key]` | `vw_dim_data[data_key]` | Sim |
| `vw_fato_movimentacao_estoque[data_key]` | `vw_dim_data[data_key]` | Sim |
| `vw_fato_snapshot_estoque[data_key]` | `vw_dim_data[data_key]` | Sim |
| `vw_fato_venda_item[data_key]` | `vw_dim_data[data_key]` | Sim |
| `vw_fato_compra_item[produto_key]` | `vw_dim_produto[produto_key]` | Sim |
| `vw_fato_movimentacao_estoque[produto_key]` | `vw_dim_produto[produto_key]` | Sim |
| `vw_fato_snapshot_estoque[produto_key]` | `vw_dim_produto[produto_key]` | Sim |
| `vw_fato_venda_item[produto_key]` | `vw_dim_produto[produto_key]` | Sim |
| `vw_fato_movimentacao_estoque[tipo_mov_key]` | `vw_dim_tipo_movimentacao[tipo_mov_key]` | Sim |
| `vw_preco_ouro[data_key]` | `vw_dim_data[data_key]` | **Não** (1:1, bidirecional; criado pela detecção automática e mantido inativo) |

**Regras:**
- Não há relacionamento entre fatos. `id_evento_origem` serve só para rastreabilidade.
- `vw_associacao_*` e `vw_info_ambiente` não se relacionam com as dimensões; as métricas de associação vêm do SQL, calculadas sobre o histórico completo (D-035).

## Configurações de colunas

- 44 colunas técnicas ocultas (chaves, `origem_dado`, `id_evento_origem` e similares).
- `vw_dim_data[nome_mes]` ordenada por `mes`; `vw_dim_data[nome_dia_semana]` por `dia_semana`.
- Agregação padrão: "soma" apenas nas 7 colunas aditivas de quantidade e valor total (`quantidade_recebida`, `custo_total_pago`, `quantidade`, `quantidade_vendida`, `valor_marcado_total`, `valor_realizado_total`, `diferenca_marcado_realizado`); "não resumir" em todas as demais, inclusive preços unitários, saldo de estoque e métricas de associação.
- Não há hierarquias definidas.

## Medidas

Pastas (`displayFolder`) e quantidades:

| Pasta | Medidas |
|---|---|
| 01 - Vendas | 11 |
| 02 - Compras | 5 |
| 03 - Estoque | 6 |
| 03 - Estoque\Movimentações | 11 |
| 04 - Precificação | 3 |
| 05 - Análises temporais | 7 |
| 05 - Análises temporais\Associações | 7 |

Expressões, descrições e formatos: `powerbi/measures.dax` (exportado do TMDL por `tools/powerbi/exportar_medidas_dax.js`). Semântica dos indicadores: `docs/indicator_catalog.md`.

## Padrões adotados

- **Estoque semiaditivo** (D-042): `[Estoque Atual (Peças)]` usa a última data com snapshot dentro do filtro (`LASTNONBLANK`); nunca soma `quantidade_em_estoque` ao longo do tempo. `[Data da Posição de Estoque]` mostra a data usada.
- **Medidas "(Exibição)"**: versões em texto (`FORMAT`) para os cartões, que tratam o vazio com `ISBLANK`.
- **Top 10 por medida** (D-041): as medidas "… - Top 10 …" usam `TOPN` com `ALLSELECTED` e retornam vazio fora do top 10, porque o filtro TopN do PBIR só aceita agregação de coluna.
- **Movimentações** (D-044): sinal vindo de `vw_dim_tipo_movimentacao`; medidas por tipo com `KEEPFILTERS`; `[Saldo Acumulado por Movimentações]` ignora o filtro de tipo.
- **Associação**: as medidas retornam o valor de uma única regra (`COUNTROWS = 1`) e nunca somam regras; `[Lift - Top 10 Regras de Produtos]` considera só regras com `vendas_com_ambos >= 5` (D-039).
- **Janelas comerciais**: médias diárias sobre os dias do calendário de cada grupo (D-040).

## Cuidados de granularidade

- **Unidades vendidas:** vêm de `vw_fato_venda_item`. As saídas por venda em `vw_fato_movimentacao_estoque` representam o mesmo evento físico; não somar as duas.
- **Peso:** apenas em `[Peso em Estoque Ouro (g)]`, nunca somado a peças.
- **Fora do modelo:** CMV, margem, estoque valorizado, giro por custo e métricas por cliente.
