# Mapeamento de origem e transformação

**Status:** fase 1 (demo) implementada em `etl/sql/demo/` e `db/views/`; ainda não executada no banco.

## Fase 1 — gerador sintético → staging_demo → dw_demo

| Origem (staging_demo) | Destino (dw_demo) | Transformação | Validação | Rejeição | Arquivo |
|---|---|---|---|---|---|
| `produto_gerado` | `dim_produto` | cópia de atributos; chave substituta | código `DEMO-`; material no domínio; Ouro com peso > 0; Folheado sem peso; Anel com tamanho; índice > 0 | `audit_demo.rejeicao` (motivo) | `etl/sql/demo/20_validar_staging.sql`, `30_carregar_dimensoes.sql` |
| `produto_perfil_simulacao` | — (não vai ao DW; apenas para a simulação e para auditoria) | — | — | — | `11_gerar_catalogo.sql` |
| calendário (`generate_series`) | `dim_data` | atributos de calendário; datas comerciais; janelas | cobre o período inteiro | — | `30_carregar_dimensoes.sql` |
| domínio fixo | `dim_tipo_movimentacao` | 7 tipos com sinal | sinal ∈ {−1, 1} | — | `db/migrations/005_dw_demo_dimensoes.sql` |
| `preco_ouro_gerado` | `parametro_preco_ouro` | versão 1, vigente, `NAO_CONFIRMADA_DEMO` | 1 por dia do período; valor > 0 | idem | `30_carregar_dimensoes.sql` |
| `entrada_gerada` | `fato_compra_item` | resolve `produto_key`, `data_key` e `parametro_preco_ouro_id` (mesma data, vigente); copia preço do ouro e índice; calcula preço sugerido (Ouro/Prata) | quantidade > 0; custo > 0; Ouro/Prata com parâmetro da **mesma data**; Folheado sem preço sugerido | idem (entrada sem parâmetro é rejeitada) | `31_carregar_fatos.sql` |
| `venda_gerada` | `fato_venda_item` | resolve chaves; totais gerados | quantidade > 0; preços > 0; produto existente | idem | `31_carregar_fatos.sql` |
| `movimento_gerado` | `fato_movimentacao_estoque` | resolve chaves e `tipo_mov_key` | quantidade > 0; tipo no domínio; SAIDA_VENDA/ENTRADA_COMPRA com item comercial correspondente | idem | `31_carregar_fatos.sql` |
| `fato_movimentacao_estoque` | `fato_snapshot_estoque` | Σ(quantidade × sinal) acumulado até o fim de cada data de referência; todos os produtos | saldo ≥ 0; único por produto e data | idem | `32_gerar_snapshots.sql` |
| `dw_demo.*` | `bi_demo.vw_*` | views de consumo; `vw_associacao_tipos` e `vw_associacao_produtos` calculam suporte, confiança e lift dentro de `id_venda_sintetica` | — | — | `db/views/bi_demo_views.sql` |

**Ordem de carga:** dimensões → parâmetro do ouro → compras → vendas → movimentações → snapshots → validações de qualidade.

**Idempotência:**
- `ON CONFLICT (id_evento_origem) DO NOTHING` nos fatos e `ON CONFLICT (codigo_produto)` na dimensão de produtos;
- o hash da configuração é registrado em `audit_demo.execucao`;
- uma configuração diferente exige `reset_demo.ps1` com confirmação.

## Fase 2 — fontes reais (futuro; NÃO aplicar agora)

O mapeamento será construído a partir de `docs/source_inventory.md`. Ele seguirá o fluxo XLSX → Python (`etl/python/`) → esquemas reais de staging → SQL → esquemas reais de DW, separados da demo. Nenhuma regra abaixo é aplicada na fase 1.

| Fonte | Destino previsto | Questões a resolver antes |
|---|---|---|
| CLS (catálogo de ouro) | dimensão de produtos reais (Ouro) | papel do arquivo (catálogo próprio ou de fornecedor); variações de grafia de categoria; significado de "Ind Preço" |
| FOLHEADOS | produtos, compras, vendas e saldo observado | uma linha = uma peça?; vendas a R$ 0,01; local "sumiu"/"novo"/nome de pessoa; códigos duplicados; datas inválidas |
| RAMON - PEÇAS | produtos de prata (se não forem redundantes) | 274/275 códigos já presentes em FOLHEADOS; bloco com colunas deslocadas; registro de pagamentos ao fornecedor fora do escopo |
