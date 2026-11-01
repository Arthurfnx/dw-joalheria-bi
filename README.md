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
| 1 — Demonstrativa | Sintéticos, determinísticos, `SINTETICO_DEMO` | `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo` | **Concluída** (2026-11-01): banco criado, ETL executado e testado, relatório Power BI com 6 páginas conferido contra o SQL |
| 2 — Integração real | Planilhas CLS (ouro), RAMON (prata), FOLHEADOS | esquemas reais próprios (não criados) | Futura; depende das respostas em `docs/pending_questions.md` |

Os dados reais e sintéticos **nunca** são misturados.

## Arquitetura (fase 1)

```
config_demo ─► gerador PL/pgSQL determinístico ─► staging_demo ─► validação ─► dw_demo (estrela) ─► bi_demo (views) ─► Power BI (Import)
                                                       audit_demo: execuções, contagens, rejeições, validações
```

Detalhes em `docs/architecture.md`, `docs/demo_data_specification.md` e `docs/data_dictionary.md`.

## Estado atual (fase 1)

| Componente | Estado |
|---|---|
| Banco | `dw_joalheria` no PostgreSQL 18.6 local; 5 esquemas `*_demo`; 21 arquivos de migration aplicados; esquemas reais inexistentes |
| Dados | 100% sintéticos: 150 produtos, 01/01/2024 a 31/12/2025, 6.370 itens vendidos, 1.789 itens comprados, 8.377 movimentações, 3.600 posições de estoque; estoque final de 520 peças |
| ETL | 3 execuções registradas: a 1ª falhou (erro de sintaxe num `CALL`, corrigido); a 2ª e a 3ª terminaram com SUCESSO, 24/24 verificações aprovadas e 0 rejeições; a 3ª confirmou idempotência e determinismo |
| Consumo | 12 views em `bi_demo`; perfil `bi_leitura` somente leitura (`db/seguranca/bi_leitura.sql`, aplicado à parte) |
| Power BI | PBIP `powerbi/relatorio_joalheria_demo.pbip`, modo Import, 12 views, 50 medidas, 10 relacionamentos, 6 páginas aprovadas pelo usuário |
| Conferência | Indicadores das 6 páginas conferidos contra o PostgreSQL (`tests/reconciliacao/`, `powerbi/validation_checklist.md`) |

## Ambiente

- Windows 11 Pro, Git, Python 3.14.10.
- PostgreSQL 18.6 local (serviço `postgresql-x64-18`).
- Power BI Desktop instalado pelo usuário.
- Node.js (somente para as ferramentas opcionais de `tools/powerbi/`).
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
├── db/seguranca/       # perfil de leitura bi_leitura (aplicado à parte)
├── etl/sql/demo/       # gerador, validação, cargas e qualidade (fase 1)
├── etl/python/         # reservado para a leitura de XLSX (fase 2; vazio)
├── scripts/            # execução (PowerShell + psql)
├── tests/sql/          # testes SQL (run_tests.ps1)
├── tests/estatico/     # verificador estático dos SQL
├── tests/reconciliacao/# conferências PostgreSQL × relatório (somente leitura)
├── tools/powerbi/      # geradores PBIR e exportação das medidas (Node.js)
├── powerbi/            # PBIP (relatório e modelo semântico), medidas exportadas, documentação
└── docs/               # arquitetura, especificação, dicionário, ETL, qualidade, indicadores, decisões
    └── referencia/     # documentos acadêmicos locais (ignorado pelo Git)
```

## Execução

Passo a passo detalhado e resultados das execuções em `docs/etl_runbook.md`. Execute a partir da raiz, no PowerShell:

```powershell
python tests\estatico\verificar_sql.py                                         # validação estática (sem banco)
powershell -ExecutionPolicy Bypass -File scripts\criar_banco.ps1               # cria PGDATABASE (confirmação)
powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1            # schemas *_demo, funções, views
powershell -ExecutionPolicy Bypass -File scripts\run_demo_etl.ps1              # gera, valida e carrega a demo
powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1 -ComReexecucao  # testes + idempotência
```

`scripts\reset_demo.ps1` (destrutivo, só dados sintéticos, exige a frase de confirmação) e `scripts\registrar_preco_ouro.ps1` (registro ou correção versionada do preço do ouro) devem ser usados somente quando autorizados.

O relatório é aberto em `powerbi\relatorio_joalheria_demo.pbip` (conexão em `powerbi/connection_guide.md`). As conferências contra o banco estão em `tests/reconciliacao/README.md`.

## Segurança e versionamento

- Não versionar `data/raw/`, `data/processed/`, `docs/referencia/`, `.env`, credenciais, dumps ou PBIX.
- O ambiente demo não é produção: o ETL e o `.env` usam o administrador `postgres`; o perfil previsto para o Power BI é `bi_leitura` (o usuário efetivamente gravado nas credenciais do Desktop está pendente de confirmação).
- Não registrar dados pessoais ou comerciais reais em código, logs ou documentação.
- Revisar `git status` antes de qualquer commit.
