# Conferências PostgreSQL × relatório Power BI

Scripts **somente leitura** que calculam no PostgreSQL os mesmos indicadores exibidos no
relatório. Cada um executa as consultas em `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`.

Servem para conferir os valores do Power BI (DAX) contra o banco. A comparação com o lado DAX
**não é automática**: durante a construção, os valores DAX foram obtidos pelo Power BI Modeling
MCP (consultas `EVALUATE`) e comparados manualmente com a saída destes scripts.

## Requisitos

- Windows PowerShell 5.1 ou superior; `psql` do PostgreSQL 18 (no PATH ou em `PG_BIN`).
- `.env` local configurado (ver `.env.example`); os scripts usam `scripts/_comum.ps1`.
- ETL demonstrativo já carregado.

## Uso

A partir da raiz do repositório:

```powershell
powershell -ExecutionPolicy Bypass -File tests\reconciliacao\conferir_estoque_vendas.ps1
```

## Scripts e valores esperados

Valores obtidos em 2026-11-01 sobre a execução 3 (`audit_demo.execucao`), período completo
(01/01/2024 a 31/12/2025). Mudam se a configuração ou o ETL forem alterados.

| Script | Páginas | Valores de referência |
|---|---|---|
| `conferir_estoque_vendas.ps1` | Estoque e Produtos, Vendas | Receita R$ 6.701.258,34; 6.819 peças; 4.415 vendas; ticket R$ 1.517,84; preço médio realizado R$ 982,73; marcado R$ 1.017,66; desconto 3,43%; estoque 520 peças em 31/12/2025; 18 produtos sem estoque; ouro 410,345 g; 150 produtos; 15 sem venda |
| `conferir_compras.ps1` | Compras e Custos | Custo R$ 3.995.958,71; 6.773 peças; 568 entradas; custo médio ponderado R$ 589,98; 1.789 itens |
| `conferir_movimentacoes.ps1` | Movimentações de Estoque | 8.377 eventos; entradas 7.380; saídas 6.860; saldo líquido 520 = snapshot de 31/12/2025; 617 em 31/12/2024; `SAIDA_ROUBO` sem eventos |
| `conferir_janelas_comerciais.ps1` | Sazonalidade (tabela de janelas) | Por janela × ano e total: dias, receita, peças e receita/dia (receita total ÷ total de dias) |
| `conferir_sazonalidade_associacao.ps1` | Sazonalidade e Associação | 86 dias em janelas / 645 demais; média diária R$ 15.834,36 × R$ 8.278,30 (+91,3%); 3.396 regras de produtos, 52 com ≥ 5 vendas conjuntas; 10º lift do ranking 7,178862; 90 regras de tipos |
| `diagnostico_banco.ps1` | — | Diagnóstico geral: esquemas, objetos, contagens, execuções, verificações, migrations, papéis e permissões |

A página Visão Geral é coberta pelos totais de `conferir_estoque_vendas.ps1`.

## Origem e alterações nas cópias versionadas

Recuperados em 2026-11-01 da pasta temporária da sessão que construiu o relatório. Os originais
são mantidos em um backup local, fora do repositório.

| Original | Versionado |
|---|---|
| `conferir_pg.ps1` | `conferir_estoque_vendas.ps1` |
| `conferir_pg_compras.ps1` | `conferir_compras.ps1` |
| `conferir_pg_mov.ps1` | `conferir_movimentacoes.ps1` |
| `conferir_pg_janelas.ps1` | `conferir_janelas_comerciais.ps1` |
| `conferir_pg_p6.ps1` | `conferir_sazonalidade_associacao.ps1` |
| `diag_pg.ps1` | `diagnostico_banco.ps1` |

Alterações feitas nas cópias:
- o caminho absoluto de `scripts/_comum.ps1` passou a ser relativo ao script (`$PSScriptRoot`);
- codificação UTF-8 com BOM e CRLF (decisão D-036 e `.gitattributes`);
- `diagnostico_banco.ps1`: coluna `aplicada_em` → `aplicado_em` (nome real em `audit_demo.migracao_aplicada`);
- `conferir_sazonalidade_associacao.ps1`:
  - `diferenca_pct` usava `− 100` em vez de `− 1` e retornava −9808,7; agora retorna 91,3;
  - `decimo_lift_min5` ordenava pela coluna de saída `lift::text` (ordem alfabética) e retornava 7,084403; agora ordena pela coluna numérica e retorna 7,178862, igual ao Power BI.

Todos foram executados com sucesso a partir do repositório em 2026-11-01.
