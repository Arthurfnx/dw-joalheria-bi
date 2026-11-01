# Guia de conexão do Power BI ao DW demonstrativo

> **AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA.**

**Status (2026-11-01):** conexão configurada e em uso no PBIP `powerbi/relatorio_joalheria_demo.pbip`; as 12 views foram importadas e os indicadores conferidos contra o SQL (`powerbi/validation_checklist.md`).

## Pré-requisitos
1. PostgreSQL 18.6 local com o banco `dw_joalheria` carregado (`scripts/run_demo_etl.ps1` com SUCESSO).
2. Power BI Desktop com o conector PostgreSQL (incluído nas versões recentes).
3. Perfil de leitura `bi_leitura`, criado por `db/seguranca/bi_leitura.sql`. A senha é cadastrada manualmente e nunca versionada.

## Abrir o relatório existente
1. Abrir `powerbi\relatorio_joalheria_demo.pbip` no Power BI Desktop.
2. Na primeira atualização, informar as credenciais de **banco de dados** para `localhost:5432;dw_joalheria`. Usar `bi_leitura`.
3. **Atualizar** relê as 12 views.

As credenciais ficam no Power BI Desktop do usuário, não no PBIP. **Pendente de confirmação:** qual usuário está gravado hoje nessas credenciais (`bi_leitura` é o previsto; o ETL usa `postgres`).

## Configuração implementada

| Item | Valor |
|---|---|
| Função M | `PostgreSQL.Database("localhost:5432", "dw_joalheria")` em cada uma das 12 consultas |
| Esquema | `bi_demo`, fixo em cada consulta |
| Modo | Importar |
| Parâmetros | nenhum |

Views importadas (nome no modelo = `bi_demo vw_<view>`):
`vw_dim_produto`, `vw_dim_data`, `vw_dim_tipo_movimentacao`, `vw_fato_compra_item`, `vw_fato_venda_item`,
`vw_fato_movimentacao_estoque`, `vw_fato_snapshot_estoque`, `vw_associacao_produtos`, `vw_associacao_tipos`,
`vw_preco_ouro`, `vw_preco_ouro_versoes`, `vw_info_ambiente`.

Não são importadas tabelas de `staging_demo`, `config_demo`, `audit_demo` nem de `dw_demo`: o consumo é sempre pelas views de `bi_demo`, e `bi_leitura` só tem acesso a elas.

## Parametrização (melhoria futura, não implementada)
Hoje, trocar de servidor, banco ou esquema exige editar as 12 consultas. Uma melhoria futura é criar parâmetros (servidor, banco, esquema) no Power Query. Na fase 2, as views reais devem manter os mesmos nomes de colunas, e dados demo e reais **nunca** devem ser combinados (append).

## Atualização dos dados
- Sem mudança de configuração, `scripts/run_demo_etl.ps1` é idempotente: o DW não muda e a atualização do Power BI devolve os mesmos números.
- Depois de qualquer mudança no DW, rodar novamente `tests/reconciliacao/` e o checklist de validação.

## Segurança
- Não versionar `.pbix`, credenciais nem `.env`.
- O ambiente demo não é produção: o administrador `postgres` é usado pelo ETL e pelas conferências; o Power BI deve ler com `bi_leitura`.
