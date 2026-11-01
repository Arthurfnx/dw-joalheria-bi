# Modelo semântico — Power BI (ambiente demonstrativo)

> **AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS.** O modelo ainda não foi montado nem validado no Power BI Desktop.

## Tabelas

| Tabela | Origem | Tipo | Grão |
|---|---|---|---|
| `dim_produto` | `bi_demo.vw_dim_produto` | Dimensão | um produto sintético |
| `dim_data` | `bi_demo.vw_dim_data` | Dimensão (tabela de datas) | um dia |
| `dim_tipo_movimentacao` | `bi_demo.vw_dim_tipo_movimentacao` | Dimensão | um tipo (7 linhas) |
| `fato_compra_item` | `bi_demo.vw_fato_compra_item` | Fato transacional | produto × entrada sintética |
| `fato_venda_item` | `bi_demo.vw_fato_venda_item` | Fato transacional | produto × venda sintética |
| `fato_movimentacao_estoque` | `bi_demo.vw_fato_movimentacao_estoque` | Fato transacional | evento de movimentação |
| `fato_snapshot_estoque` | `bi_demo.vw_fato_snapshot_estoque` | Fato snapshot (semiaditivo) | produto × fim de mês |
| `preco_ouro` | `bi_demo.vw_preco_ouro` | Auxiliar | um dia (versão vigente) |
| `associacao_tipos` | `bi_demo.vw_associacao_tipos` | Auxiliar (pré-agregada, período completo) | par de tipos de peça |
| `associacao_produtos` | `bi_demo.vw_associacao_produtos` | Auxiliar (pré-agregada, período completo) | par de produtos |
| `info_ambiente` | `bi_demo.vw_info_ambiente` | Auxiliar | 1 linha (aviso e metadados) |

## Relacionamentos (todos 1:N, filtro em direção única, da dimensão para o fato)

| Dimensão (1) | Fato (N) | Coluna |
|---|---|---|
| `dim_data[data_key]` | `fato_compra_item[data_key]` | data_key |
| `dim_data[data_key]` | `fato_venda_item[data_key]` | data_key |
| `dim_data[data_key]` | `fato_movimentacao_estoque[data_key]` | data_key |
| `dim_data[data_key]` | `fato_snapshot_estoque[data_key]` | data_key |
| `dim_data[data_key]` | `preco_ouro[data_key]` | data_key |
| `dim_produto[produto_key]` | `fato_compra_item`, `fato_venda_item`, `fato_movimentacao_estoque`, `fato_snapshot_estoque` | produto_key |
| `dim_tipo_movimentacao[tipo_mov_key]` | `fato_movimentacao_estoque[tipo_mov_key]` | tipo_mov_key |

**Regras:**
- **Não** criar relacionamentos entre fatos. `id_evento_origem` é só para rastreabilidade.
- As tabelas `associacao_*` e `info_ambiente` **não** se relacionam com as dimensões. As métricas de associação são calculadas no SQL sobre o período completo.
- Marcar `dim_data` como **tabela de datas** (coluna `data`).
- Ordenar `dim_data[nome_mes]` por `mes` e `dim_data[nome_dia_semana]` por `dia_semana`.
- Ocultar as colunas técnicas: chaves, `origem_dado` e `id_evento_origem`.
- Formatos:
  - R$ com 2 casas para valores;
  - inteiro para peças;
  - percentual para as medidas "%".

## Hierarquias sugeridas
- **Produto:** material → tipo_peca → codigo_produto. Material e tipo de peça são **atributos distintos**; a hierarquia é apenas de navegação.
- **Calendário:** ano → trimestre → nome_mes → data.

## Medidas
Estão em `powerbi/measures.dax`, com unidade e ressalvas comentadas. A semântica completa está em `docs/indicator_catalog.md`.

## Cuidados de granularidade
- **Saldo:** usar sempre `[Saldo Atual (peças)]`, que pega o último snapshot. Nunca somar `quantidade_em_estoque` ao longo do tempo.
- **Unidades vendidas:** usar `fato_venda_item`. As saídas por venda em `fato_movimentacao_estoque` representam o mesmo evento físico; não somar as duas.
- **Peso:** apenas na medida própria, nunca somado a peças.
