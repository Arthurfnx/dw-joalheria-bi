# Data Warehouse e Business Intelligence — Joalheria

Projeto acadêmico de Sistemas de Informação (extensão, Eixo 4): solução de Business Intelligence com **PostgreSQL**, **Data Warehouse dimensional**, **ETL** e **Power BI** para apoiar a gestão de estoque e vendas de uma joalheria.

> **Fase atual: ambiente demonstrativo com DADOS SINTÉTICOS.**
> Nenhum número produzido nesta fase representa resultados reais da empresa.

## Objetivo

Demonstrar a viabilidade técnica e acadêmica de um DW integrado (compras, vendas, movimentações e saldos de estoque) consumido pelo Power BI. A demonstração cobre:

- saldo atual;
- estoque por material e tipo de peça;
- entradas e saídas;
- produtos mais e menos vendidos;
- comparação entre períodos;
- produtos sem movimentação;
- evolução do estoque;
- preço sugerido × marcado × realizado;
- datas comerciais;
- associação entre produtos de uma mesma venda (somente com identificadores sintéticos).

**Fora do escopo:** sistema web transacional, pagamentos, financeiro, fornecedores, logística, frete, e-commerce, clientes, previsão de demanda, margem bruta, estoque valorizado e giro por custo.

## Fases

| Fase | Dados | Esquemas | Situação |
|---|---|---|---|
| 1 — Demonstrativa | Sintéticos, determinísticos, `SINTETICO_DEMO` | `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo` | Implementação concluída e validada **estaticamente**; aguarda execução e validação no PostgreSQL |
| 2 — Integração real | Planilhas CLS (ouro), RAMON (prata), FOLHEADOS | esquemas reais próprios (a criar) | Futura; regras de tratamento documentadas em `docs/source_inventory.md` |

Os dados reais e sintéticos **nunca** são misturados.

## Arquitetura (fase 1)

```
config_demo ─► gerador PL/pgSQL determinístico ─► staging_demo ─► validação ─► dw_demo (estrela) ─► bi_demo (views) ─► Power BI (Import)
                                                       audit_demo: execuções, contagens, rejeições, validações
```

Detalhes em `docs/architecture.md`, `docs/demo_data_specification.md` e `docs/data_dictionary.md`.

## Ambiente

- Windows 11 Pro, Git, Python 3.14.10.
- PostgreSQL 18.6 local (serviço `postgresql-x64-18`).
- Power BI Desktop: instalado pelo usuário; conexão e medidas ainda não validadas.
- Docker não é usado.
- Configuração local: copie `.env.example` para `.env` e preencha as credenciais. Use `PG_BIN` se o `psql` não estiver no PATH.

## Estrutura do repositório

```text
.
├── CLAUDE.md, README.md, .env.example
├── data/raw/           # fontes reais (ignorado pelo Git; não usadas na fase 1)
├── data/processed/     # derivados locais (ignorado pelo Git)
├── db/migrations/      # criação dos esquemas e tabelas
├── db/views/           # views bi_demo
├── etl/sql/demo/       # gerador, validação, cargas e qualidade (fase 1)
├── etl/python/         # leitura de XLSX (fase 2)
├── scripts/            # execução (PowerShell + psql)
├── tests/sql/          # testes SQL
├── powerbi/            # DAX, modelo, páginas, conexão, checklist
└── docs/               # arquitetura, especificação, dicionário, ETL, qualidade, indicadores, decisões
    └── referencia/     # documentos acadêmicos locais (ignorado pelo Git)
```

## Execução

A implementação da fase 1 está **concluída e validada estaticamente** (verificador SQL e parser do PowerShell). Ela **aguarda execução e validação no PostgreSQL 18.6**: o banco ainda não foi criado e nenhuma migration foi aplicada. Passo a passo detalhado em `docs/etl_runbook.md`. Execute a partir da raiz, no PowerShell:

```powershell
python tests\estatico\verificar_sql.py                                         # validação estática (sem banco)
powershell -ExecutionPolicy Bypass -File scripts\criar_banco.ps1               # cria PGDATABASE (confirmação)
powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1            # schemas *_demo, funções, views
powershell -ExecutionPolicy Bypass -File scripts\run_demo_etl.ps1              # gera, valida e carrega a demo
powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1 -ComReexecucao  # testes + idempotência
```

`scripts\reset_demo.ps1` (destrutivo, só dados sintéticos, exige a frase de confirmação) e `scripts\registrar_preco_ouro.ps1` (registro ou correção versionada do preço do ouro) devem ser usados somente quando autorizados.

## Segurança e versionamento

- Não versionar `data/raw/`, `data/processed/`, `docs/referencia/`, `.env`, credenciais, dumps ou PBIX.
- Não registrar dados pessoais ou comerciais reais em código, logs ou documentação.
- Revisar `git status` antes de qualquer commit.
