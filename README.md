# Nobreza Jóias — Data Warehouse, Business Intelligence e aplicação web

Projeto acadêmico de Sistemas de Informação (extensão, Eixo 4) para uma joalheria real, a Nobreza Jóias. Reúne três partes:

1. **Aplicação web** de produtos, estoque e vendas, que passa a ser a fonte oficial dos dados operacionais.
2. **Data Warehouse dimensional** em PostgreSQL, alimentado por ETL a partir da aplicação.
3. **Relatório Power BI** sobre o DW, exibido também dentro da aplicação.

Há ainda um **ambiente demonstrativo** com dados sintéticos, usado na primeira entrega para validar o modelo dimensional e o relatório antes de existirem dados reais. Ele é mantido separado e não se mistura com os dados reais.

## Arquitetura

```
Planilhas da joalheria ──(importação única)──┐
                                             ▼
Navegador ──► Aplicação web (Next.js) ──► nobreza_app (PostgreSQL, banco operacional)
                                             │  ETL (papel somente leitura, sem nomes de pessoas)
                                             ▼
                              dw_joalheria: staging ─► dw (estrela) ─► bi (views) ─► Power BI
                                            audit: execuções, contagens, rejeições e verificações

Ambiente demonstrativo (separado): config_demo ─► staging_demo ─► dw_demo ─► bi_demo ─► relatório demonstrativo
```

## Componentes

| Componente | Onde | Descrição |
|---|---|---|
| Aplicação web | `web/` | Next.js, React e TypeScript. Login com perfis Administrador e Vendedor, cadastro de produtos (inclusive peças de ouro com índice de preço e tamanho em anéis e alianças), estoque com saídas não comerciais, ajustes e consignação, vendas com baixa automática e cancelamento com estorno, preço do ouro com preço sugerido, importação das planilhas, auditoria e tela de relatórios |
| Banco operacional | `nobreza_app` | Regras de estoque garantidas no próprio banco: funções PL/pgSQL são o único caminho de escrita em vendas, movimentações e saldos; movimentações imutáveis; saldo nunca negativo |
| DW real | esquemas `staging`, `dw`, `bi`, `audit` de `dw_joalheria` | Dimensões de produto, data e tipo de movimentação; fatos de venda, compra, movimentação e snapshot diário de estoque; 12 views de consumo |
| Relatório real | `powerbi/relatorio_joalheria.pbip` | Modo Import, sobre o esquema `bi` |
| Ambiente demonstrativo | esquemas `*_demo` e `powerbi/relatorio_joalheria_demo.pbip` | 150 produtos sintéticos, 2024–2025, gerados de forma determinística; 7 páginas e 61 medidas |

## Regras de negócio que o modelo respeita

- Saídas não comerciais (presente, perda, roubo) reduzem o estoque, mas não são venda.
- Ticket médio e associação entre produtos só usam vendas registradas na aplicação, que têm número de venda. As vendas históricas importadas das planilhas não têm identificador de transação e ficam fora desses cálculos.
- Preços são unitários; quantidades e peso nunca são somados entre si.
- Margem bruta, custo das mercadorias vendidas e giro por custo não são calculados enquanto não houver política de valorização de estoque.
- Nomes de clientes nunca são importados; o nome de quem está com uma peça consignada fica só na aplicação e nunca chega ao DW nem ao relatório.

## Requisitos

- Windows, PostgreSQL 18 local (serviço `postgresql-x64-18`), Node.js 22, Python 3 (só para o verificador estático de SQL) e Power BI Desktop.
- Docker não é usado.
- Se o `psql` não estiver no PATH, defina `PG_BIN` (por exemplo, `C:\Program Files\PostgreSQL\18\bin`).
- Copie `.env.example` para `.env` e `web/.env.example` para `web/.env`, e preencha localmente. Nenhum dos dois `.env` é versionado.

## Execução

**Aplicação web:** passo a passo em [`web/README.md`](web/README.md) (bancos e papéis, migrations, primeiro administrador, importação das planilhas, execução e testes).

**DW real e relatório:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_migrations_real.ps1   # estrutura do DW real
powershell -ExecutionPolicy Bypass -File scripts\run_etl_app.ps1           # carga a partir da aplicação (recarga completa)
```

Detalhes em [`etl/sql/app/README.md`](etl/sql/app/README.md). A conexão do relatório está em [`powerbi/connection_guide.md`](powerbi/connection_guide.md).

**Ambiente demonstrativo:**

```powershell
python tests\estatico\verificar_sql.py                                         # validação estática dos SQL
powershell -ExecutionPolicy Bypass -File scripts\criar_banco.ps1               # cria o banco (pede confirmação)
powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1            # esquemas *_demo, funções e views
powershell -ExecutionPolicy Bypass -File scripts\run_demo_etl.ps1              # gera, valida e carrega a demo
powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1 -ComReexecucao  # testes e idempotência
```

Detalhes em [`docs/etl_runbook.md`](docs/etl_runbook.md).

## Testes

| Parte | Como |
|---|---|
| Aplicação web | `npm run test` em `web/`: testes unitários e de integração contra um banco de teste próprio (`nobreza_app_teste`), incluindo concorrência e os invariantes de estoque |
| DW real | Verificações de qualidade ao fim de cada carga; `tests/dw_real/` (idempotência, ambiente demonstrativo intacto, ausência de nomes de pessoas) |
| Ambiente demonstrativo | `scripts\run_tests.ps1` e o verificador estático |
| Relatórios | Conferências SQL × Power BI em `tests/reconciliacao/` |

## Estrutura do repositório

```text
.
├── web/                 # aplicação web (código, migrations, testes)
├── db/migrations/       # DW: esquemas *_demo; real/ para os esquemas reais
├── db/views/            # views de consumo (bi_demo e real/)
├── db/seguranca/        # perfis de leitura do Power BI
├── etl/sql/demo/        # gerador, validação e cargas do ambiente demonstrativo
├── etl/sql/app/         # ETL do banco operacional para o DW real
├── scripts/             # execução (PowerShell + psql)
├── tests/               # testes SQL, verificador estático, DW real e reconciliação
├── tools/powerbi/       # geradores das páginas do relatório (Node.js)
├── powerbi/             # projetos PBIP, medidas e guias
└── docs/                # arquitetura, dicionário de dados, ETL, qualidade, indicadores, decisões
    └── app_web/         # especificação da aplicação web
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/app_web/especificacao.md`](docs/app_web/especificacao.md) | Regras de negócio, invariantes, modelo de dados, telas e importação da aplicação |
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura do DW |
| [`docs/data_dictionary.md`](docs/data_dictionary.md) | Dicionário de dados do DW |
| [`docs/indicator_catalog.md`](docs/indicator_catalog.md) | Indicadores: fórmula, unidade, período e limitações |
| [`docs/decisions/decision_log.md`](docs/decisions/decision_log.md) | Registro de decisões de modelagem |
| [`docs/source_inventory.md`](docs/source_inventory.md) | Inventário das planilhas de origem (sem dados pessoais) |

## Segurança e privacidade

- Não são versionados: planilhas de origem (`data/raw/`), arquivos derivados (`data/processed/`), documentos de referência, `.env`, credenciais, backups e arquivos PBIX.
- A aplicação nunca usa a conta de administrador do PostgreSQL: cada parte tem seu papel, com o mínimo de privilégios.
- Senhas são guardadas só como hash Argon2id; sessões ficam no servidor, com cookie `HttpOnly`.
- O relatório exibido na aplicação é publicado pelo recurso "Publicar na Web" do Power BI, que é público por natureza. Por isso o modelo publicado não contém nomes de pessoas.
