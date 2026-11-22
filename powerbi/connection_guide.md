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

---

# Relatório real (`powerbi/relatorio_joalheria.pbip`) — DW real, esquema `bi`

**Status (2026-11-22):** cópia do relatório demonstrativo ligada ao esquema `bi` do DW real, que recebe os dados do banco operacional `nobreza_app` (aplicação web). O relatório demonstrativo acima não foi alterado. Este relatório é publicado por "Publicar na Web" (link público): o DW e o modelo **não contêm nomes de pessoas** (clientes nem a pessoa com quem uma peça está consignada); valores de custo podem ser publicados (decisões do usuário de 2026-11-21).

## Pré-requisitos

1. Esquemas reais criados: `scripts\run_migrations_real.ps1` (aplica `db/migrations/real`, `etl/sql/app`, `db/views/real` e `db/seguranca/bi_leitura_real.sql`).
2. DW carregado: `scripts\run_etl_app.ps1` com SUCESSO. Requer no `.env` da raiz a senha do papel `nobreza_leitura_dw` (`APP_PGPASSWORD`; ver `.env.example`).
3. Perfil `bi_leitura` com senha cadastrada manualmente (nunca versionada). Ele só enxerga as views de `bi`.

## Abrir e atualizar

1. Abrir `powerbi\relatorio_joalheria.pbip` no Power BI Desktop.
2. Na primeira atualização, informar as credenciais de **banco de dados** para `localhost:5432;dw_joalheria`, com `bi_leitura`.
3. **Página Inicial → Atualizar.** As 12 consultas leem as views de `bi` (`PostgreSQL.Database("localhost:5432", "dw_joalheria")`, esquema `bi`, modo Importar).
4. Conferir os números com `tests\reconciliacao\conferir_relatorio_real.ps1`.

## Diferenças em relação ao relatório demonstrativo

| Item | Demonstrativo (`bi_demo`) | Real (`bi`) |
|---|---|---|
| Aviso no topo das páginas | Ambiente demonstrativo | Cabeçalho "Nobreza Jóias — dados do sistema de gestão" |
| Vendas | Uma origem sintética | `origem_dado` = `APLICACAO` (vendas do sistema, com número de venda) ou `PLANILHA` (histórico importado, sem número de venda) |
| Receita Realizada | Σ `valor_realizado_total` | Σ `valor_faturado`: exclui valor simbólico (R$ 0,01) e vendas sem valor; medidas separadas por origem (`Receita Realizada - Aplicação` / `- Planilha`) |
| Número de vendas, ticket médio | Identificador artificial | Só vendas do sistema (`id_venda`, RN-73); vazios até haver vendas registradas |
| Preço de tabela, desconto | Todas as vendas | Só vendas do sistema com preço de tabela (a planilha não tem) |
| Compras | Entradas sintéticas com identificador | Uma linha por peça com data de aquisição; sem identificador de compra (a planilha não tem); ouro sem data não entra |
| Estoque | Posições mensais 2024–2025 | Posições diárias **a partir da importação da planilha**; nenhuma posição anterior |
| Tipos de movimentação | `SALDO_INICIAL` … | Códigos da aplicação: `IMPLANTACAO`, `SAIDA_PERDA`, `ESTORNO_VENDA`, `ESTORNO_COMPRA` etc. |
| Associação | IDs sintéticos | Só vendas do sistema; tabelas vazias até haver vendas com mais de uma peça |
| Preço do ouro | Série sintética | Registros do cliente na aplicação (R$/g de ouro 1000, hipótese Q6); `Preço do Ouro Vigente` e `preco_sugerido_atual` (RN-68, função `app.preco_sugerido`) |
| Datas comerciais | Efeitos simulados | Só a convenção de janelas (calendário), sem efeito esperado |

Medidas novas: `Receita Realizada - Aplicação`, `Receita Realizada - Planilha`, `Quantidade Vendida - Aplicação`, `Quantidade Vendida - Planilha`, `Vendas fora do Faturamento (Peças)`, `Saídas por Perda (Peças)`, `Estornos de Venda (Peças)`, `Preço do Ouro Vigente` (69 medidas no total).

## Publicar na Web (feito pelo usuário)

1. No Power BI Desktop: **Publicar** no workspace da conta educacional.
2. No Power BI Service, abrir o relatório: **Arquivo → Inserir relatório → Publicar na Web (público)** e gerar o código.
3. Copiar o endereço do link para `POWERBI_URL_RELATORIO` em `web/.env` (nunca versionado).
4. O conjunto de dados publicado não se atualiza sozinho com o banco local (sem gateway; fora do escopo): para refletir novas vendas, rodar o ETL, atualizar no Desktop e publicar de novo.
