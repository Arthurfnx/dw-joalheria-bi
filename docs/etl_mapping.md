# Mapeamento de origem e transformação

**Status:** a solução real (fase 2) está implementada e em uso no Azure; o mapeamento da fase 1 (ambiente demonstrativo) fica no fim, como histórico.

## Solução real: planilhas → importação → sistema → ETL → DW

### 1. Planilhas → banco operacional (importação única)

Comando `npm run importar:planilhas -- <caminho do XLSX>`, em `web/`, uma única vez, num banco sem produtos. Regras completas: seção 6 de `docs/app_web/especificacao.md`; tratamento das inconsistências: `docs/data_quality.md`.

| Fonte | Destino (`nobreza_app`, esquema `app`) | Regra |
|---|---|---|
| Aba FOLHEADOS | `produto`, `produto_origem`, `movimentacao_estoque` (IMPLANTACAO), `venda_historica` | Uma linha = uma peça. Material pelo padrão do código (`R07…` = Prata; `N-NNNN` = Folheado, a confirmar). Categoria pela primeira palavra da descrição, normalizada. Situação e saldo pelo local do estoque. Venda com data válida gera `venda_historica`, sem número de venda e sem cliente |
| Aba RAMON - PEÇAS | idem | Só as peças cujo código não existe em FOLHEADOS; bloco de colunas deslocadas, serviços e registro de pagamentos não entram |
| Aba CATEGORIAS | — | Não usada |
| CLS (catálogo de ouro) | `produto`, `produto_origem`, `movimentacao_estoque` (IMPLANTACAO) | Todas as peças em estoque, saldo 1, material Ouro; categoria pela coluna CATEGORIA, normalizada; tamanho só em anéis e alianças; índice de preço; valor e data de aquisição vazios, para o cliente preencher |
| Toda a importação | `importacao_lote`, `importacao_ocorrencia` | Contagens por aba; rejeições e pendências de revisão com aba, linha, motivo e código |

### 2. Sistema → banco operacional (operação diária)

Vendas, saídas não comerciais, ajustes, consignação, cadastro de produtos e preço do ouro são registrados pela aplicação, no ato, em `app.venda`, `app.venda_item`, `app.movimentacao_estoque`, `app.saldo_estoque`, `app.produto` e `app.preco_ouro`. As escritas de estoque passam só pelas funções PL/pgSQL do banco.

### 3. Banco operacional → DW (ETL)

Comando e evidência de execução em `docs/etl_runbook.md`. Papel de origem `nobreza_leitura_dw`, que não lê nomes de pessoas.

| Origem (`app`) | Staging | Destino (`dw`) | Transformação |
|---|---|---|---|
| `produto` + `material`, `categoria`, `subcategoria`, `produto_origem` | `staging.produto` | `dim_produto` | `produto_key` = id da aplicação; tipo de peça = categoria; local "Consignado" sem o nome; preço sugerido pela regra RN-68; `origem_dado` PLANILHA se importado, APLICACAO se cadastrado no sistema |
| `tipo_movimentacao` | `staging.tipo_movimentacao` | `dim_tipo_movimentacao` | Mesmos códigos, com sinal |
| `venda` + `venda_item` (só confirmadas) | `staging.venda`, `staging.venda_item` | `fato_venda_item` (APLICACAO) | `id_venda` = número da venda; canceladas ficam fora; vendedor e observação não são extraídos |
| `venda_historica` | `staging.venda_historica` | `fato_venda_item` (PLANILHA) | Sem `id_venda`; venda simbólica e sem valor fora de `valor_faturado` |
| `produto` com data de aquisição | `staging.produto` | `fato_compra_item` | Quantidade 1; custo = valor de aquisição; sem identificador de compra |
| `preco_ouro` | `staging.preco_ouro` | `parametro_preco_ouro` | Versões por data de vigência; quem registrou não é extraído |
| `movimentacao_estoque` | `staging.movimentacao_estoque` | `fato_movimentacao_estoque` | Uma linha por movimentação; motivo (texto livre) e usuário não são extraídos |
| saldos e movimentações | — | `fato_snapshot_estoque` | Retrato diário de cada produto, da data da importação até a data de referência |
| datas dos fatos | — | `dim_data` | Calendário do dia mais antigo dos fatos até a data de referência |
| `dw.*` | — | `bi.vw_*` (12 views) | Views de consumo lidas pela tela Relatórios e pelo Grafana (papel `bi_leitura`) |

**Ordem de carga:** extração (transação REPEATABLE READ) → staging → validação (rejeições em `audit.rejeicao`) → dimensões → fatos → retratos → 14 verificações de qualidade.

**Idempotência:** recarga completa de `staging`, `dw` e `bi` a cada execução; o resultado depende só do estado do banco operacional. `audit` só recebe inserções.

---

## Fase 1 — gerador sintético → staging_demo → dw_demo (histórico)

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
