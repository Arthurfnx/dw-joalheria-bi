# ETL do DW real (banco operacional → `dw_joalheria`)

Leva os dados da aplicação web (`nobreza_app`, esquema `app`) para os esquemas reais `staging`, `dw`,
`bi` e `audit` de `dw_joalheria`. Os esquemas `*_demo` da fase 1 não são lidos nem alterados.

## Execução

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_migrations_real.ps1   # estrutura (idempotente)
powershell -ExecutionPolicy Bypass -File scripts\run_etl_app.ps1           # carga (recarga completa)
```

`.env` da raiz: `PG*` do DW (administrador) e, para a origem, `APP_PGDATABASE` (padrão `nobreza_app`),
`APP_PGUSER` (padrão `nobreza_leitura_dw`) e `APP_PGPASSWORD`. O script recusa rodar se o papel de
origem for superusuário ou puder ler `consignado_com`, `local_original` ou `app.usuario`.

## Fluxo

| Etapa | Arquivo | Efeito |
|---|---|---|
| Extração | `extracao/extrair_app.psql` | `COPY … TO STDOUT \g` para `data/processed/etl_app/*.csv` (ignorada pelo Git), numa transação REPEATABLE READ; inclui as contagens de origem (`extracao.csv`) |
| Staging | `scripts/run_etl_app.ps1` | `staging.esvaziar()` e `\copy … HEADER MATCH` de cada CSV |
| Validação | `20_validar_staging.sql` | Rejeições em `audit.rejeicao` (chave = id técnico; nunca texto livre) |
| Carga | `30_carregar_dw.sql` | `dw.carregar()`: recarga completa das dimensões, fatos e snapshots |
| Qualidade | `40_verificacoes_qualidade.sql` | `audit.executar_verificacoes()`; qualquer reprovação encerra a execução como FALHA (saída 2) |
| Auditoria | `10_auditoria.sql` | `audit.execucao`, `audit.etapa` (lidas, carregadas e rejeitadas por tabela). `audit` só recebe inserções (gatilho) |

## Mapeamento

| Origem (`app`) | Destino | Regra |
|---|---|---|
| `produto` + `material`, `categoria`, `subcategoria`, `produto_origem` | `dw.dim_produto` | `produto_key` = id da aplicação; `tipo_peca` = categoria; local "Consignado" sem nome; `origem_dado` PLANILHA se importado |
| `tipo_movimentacao` | `dw.dim_tipo_movimentacao` | Mesmos códigos; chaves fixas (1–10) |
| `venda` + `venda_item` (CONFIRMADA) | `dw.fato_venda_item` | `APLICACAO`, `id_venda` = número da venda; canceladas ficam fora |
| `venda_historica` | `dw.fato_venda_item` | `PLANILHA`, sem `id_venda`; simbólico e sem valor fora de `valor_faturado` |
| `produto` com `data_aquisicao` | `dw.fato_compra_item` | Quantidade 1, custo = valor de aquisição; sem identificador de compra |
| `preco_ouro` | `dw.parametro_preco_ouro` | Versões por data de vigência; só a última de cada data é vigente |
| `movimentacao_estoque` | `dw.fato_movimentacao_estoque` | Uma linha por movimentação; sem motivo nem usuário |
| saldos derivados | `dw.fato_snapshot_estoque` | Diário, da data da importação (primeiro `importacao_lote`) até a data da extração; nada antes |

## Verificações (`audit.resultado_validacao`)

`QLD-01` origem × staging por tabela; `QLD-02` produtos; `QLD-03` vendas PLANILHA = `venda_historica`;
`QLD-04` itens e vendas da aplicação (só confirmadas); `QLD-05` compras = peças com data de aquisição;
`QLD-06` movimentações e preço do ouro; `EST-01` snapshot do último dia = saldo da aplicação;
`EST-02` Σ movimentações = saldo (I2); `EST-03` snapshots só a partir da importação; `ORF-01` nenhuma
linha órfã; `VDA-01` simbólico fora do faturamento; `VDA-02` associação só com vendas da aplicação;
`PRC-01` preço sugerido = RN-68; `PRV-01` nenhuma coluna de pessoa em `staging`, `dw` e `bi`.

## Limitações

- Recarga completa: o DW guarda só o estado atual da aplicação; não há histórico de cargas além de `audit`.
- `preco_venda_marcado_unitario` das compras é o preço de venda do cadastro na data da carga.
- As janelas de datas comerciais são uma convenção de análise herdada da fase 1, não informação da empresa.
- Depois que os esquemas reais existem, a verificação `EST-01` do ETL demonstrativo (que exige que eles
  não existam) passa a reprovar se `scripts\run_demo_etl.ps1` for executado de novo. Os dados da fase 1
  não mudam; a verificação da fase 1 não foi alterada. O mesmo vale para `tests/sql/01_estrutura.sql`
  (`scripts\run_tests.ps1` da fase 1), que confere a ausência dos esquemas reais.
