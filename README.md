# Nobreza Jóias — Data Warehouse, Business Intelligence e aplicação web

Projeto acadêmico de Sistemas de Informação (extensão, Eixo 4) para uma joalheria real, a Nobreza Jóias. Reúne quatro partes, todas hospedadas no Microsoft Azure (região Brasil Sul):

1. **Aplicação web** de produtos, estoque e vendas, a fonte oficial dos dados operacionais. Começou com os dados reais das planilhas da joalheria, importados uma única vez.
2. **Data Warehouse dimensional** em PostgreSQL, alimentado por ETL a partir do banco da aplicação.
3. **Painéis de indicadores**: 7 seções lidas do DW, exibidas na tela Relatórios do sistema e num painel público do Grafana Cloud.
4. **Tela Indicadores** do sistema: 3 indicadores lidos do banco operacional, com escolha do formato de gráfico e o formato recomendado.

Há ainda um **ambiente demonstrativo** com dados sintéticos, da primeira entrega, que validou o modelo dimensional e um relatório Power BI antes de existirem dados reais. Ele é mantido separado e não se mistura com os dados reais.

## Endereços

| O quê | Endereço |
|---|---|
| Sistema (login obrigatório) | https://nobreza-joias-ctckede5c0fsf5fu.brazilsouth-01.azurewebsites.net |
| Painel público de indicadores (Grafana, sem login) | https://keencrab316.grafana.net/public-dashboards/42a612c666b34286b18cf98bf78affa6 |

## Arquitetura

```
Planilhas da joalheria ──(importação única)──┐
                                             ▼
Navegador ──► Aplicação web (Next.js, Azure App Service)
                 │            │
                 │            ▼
                 │      nobreza_app (banco operacional)          ┐
                 │            │  ETL (papel só leitura,          │ Azure Database for PostgreSQL
                 │            ▼  sem nomes de pessoas)           │ servidor flexível nobreza-dw
                 │      dw_joalheria: staging ─► dw ─► bi        │ PostgreSQL 18.6
                 │                    audit (execuções,          │
                 │                    rejeições, verificações)   ┘
                 │                                 │ papel bi_leitura (só as views bi)
                 ├──── tela Relatórios: 7 seções ◄─┤
                 └──── botão "Abrir o painel" ──► Grafana Cloud: 7 seções (painel público e painel com filtros)

Ambiente demonstrativo (separado, local): config_demo ─► staging_demo ─► dw_demo ─► bi_demo ─► relatório Power BI demonstrativo
```

Detalhes em [`docs/architecture.md`](docs/architecture.md).

## Componentes

| Componente | Onde | Descrição |
|---|---|---|
| Aplicação web | `web/`; Azure App Service (Linux, Node 22) | Next.js, React e TypeScript. Login com perfis Administrador e Vendedor; cadastro de produtos (inclusive peças de ouro com índice de preço e tamanho em anéis e alianças); estoque com saídas não comerciais, ajustes e consignação; vendas com baixa automática e cancelamento com estorno; preço do ouro com preço sugerido; importação das planilhas; auditoria; telas Indicadores e Relatórios |
| Banco operacional | `nobreza_app` | Regras de estoque garantidas no próprio banco: funções PL/pgSQL são o único caminho de escrita em vendas, movimentações e saldos; movimentações imutáveis; saldo nunca negativo |
| DW real | esquemas `staging`, `dw`, `bi`, `audit` de `dw_joalheria` | Dimensões de produto, data e tipo de movimentação; fatos de venda, compra, movimentação e retrato diário de estoque; 12 views de consumo |
| ETL | `etl/sql/app/` e `scripts/run_etl_app.ps1` | PowerShell + `psql`, recarga completa, auditada em `audit` com 14 verificações de qualidade |
| Painéis de indicadores | tela Relatórios do sistema; `tools/grafana/` | As mesmas 7 seções: vendas por período; tipos vendidos; taxa de venda e tempo até a venda; produtos parados; tipo que mais fica parado; sazonalidade; reposição (proposta) |
| Tela Indicadores | `web/` | Vendas por mês, estoque por categoria e estoque por material, cada um com seletor de formato e o formato recomendado |
| Ambiente demonstrativo | esquemas `*_demo` e `powerbi/relatorio_joalheria_demo.pbip` | 150 produtos sintéticos, 2024–2025, gerados de forma determinística; relatório Power BI com 7 páginas e 61 medidas |

O Power BI foi descartado na solução real: publicar e compartilhar exige licença paga (Pro ou PPU), o "Publicar na Web" está bloqueado no locatário da universidade e a licença seria um custo para o cliente. O relatório `powerbi/relatorio_joalheria.*` fica no repositório como histórico e não é mantido. A decisão está em [`docs/decisions/decision_log.md`](docs/decisions/decision_log.md).

## Regras de negócio que o modelo respeita

- Saídas não comerciais (presente, perda, roubo) reduzem o estoque, mas não são venda.
- As vendas históricas importadas das planilhas não têm identificador de transação. Por isso número de vendas, ticket médio e associação entre produtos foram retirados dos painéis: só valem para vendas registradas no sistema, que têm número de venda.
- Vendas de valor simbólico (R$ 0,01) e sem valor contam como peças vendidas, mas não entram na receita.
- Preços são unitários; peças, reais e peso nunca são somados entre si nem dividem o mesmo eixo.
- "Taxa de venda" e "tempo até a venda" não são o giro de estoque tradicional. Margem bruta, custo das mercadorias vendidas e giro por custo não são calculados enquanto não houver política de valorização de estoque.
- Nomes de clientes nunca são importados; o nome de quem está com uma peça consignada fica só na aplicação e nunca chega ao DW nem aos painéis.

Catálogo completo, com fórmula, unidade, período e limitações: [`docs/indicator_catalog.md`](docs/indicator_catalog.md).

## Requisitos (execução local)

- Windows, PostgreSQL 18 (serviço `postgresql-x64-18`), Node.js 22 e Python 3 (só para o verificador estático de SQL). Power BI Desktop só para abrir o relatório demonstrativo.
- Docker não é usado.
- Se o `psql` não estiver no PATH, defina `PG_BIN` (por exemplo, `C:\Program Files\PostgreSQL\18\bin`).
- Copie `.env.example` para `.env` e `web/.env.example` para `web/.env`, e preencha localmente. Nenhum `.env` é versionado.

## Execução

**Aplicação web:** passo a passo em [`web/README.md`](web/README.md) (bancos e papéis, migrations, primeiro administrador, importação das planilhas, execução e testes). Variáveis dos painéis: `PAINEL_URL` (link público do Grafana) e `DW_DATABASE_URL` (leitura do DW com o papel `bi_leitura`).

**ETL contra o Azure:** as credenciais ficam no arquivo local `.env.dw_azure`, ignorado pelo Git (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE` do DW e `APP_PGHOST`, `APP_PGPORT`, `APP_PGDATABASE`, `APP_PGUSER`, `APP_PGPASSWORD`, `APP_PGSSLMODE` da origem). `DW_ARQUIVO_ENV` escolhe esse arquivo no lugar do `.env` da raiz:

```powershell
$env:DW_ARQUIVO_ENV='<caminho do .env.dw_azure>'; powershell -ExecutionPolicy Bypass -File scripts\run_etl_app.ps1
```

Sem `DW_ARQUIVO_ENV`, o mesmo script usa o `.env` da raiz (DW local). A estrutura do DW é criada por `scripts\run_migrations_real.ps1`. Evidência da execução no Azure em [`docs/etl_runbook.md`](docs/etl_runbook.md); detalhes técnicos em [`etl/sql/app/README.md`](etl/sql/app/README.md).

**Painel do Grafana:** fonte de dados, importação, link público e convites em [`tools/grafana/README.md`](tools/grafana/README.md).

**Ambiente demonstrativo (histórico):**

```powershell
python tests\estatico\verificar_sql.py                                         # validação estática dos SQL
powershell -ExecutionPolicy Bypass -File scripts\criar_banco.ps1               # cria o banco (pede confirmação)
powershell -ExecutionPolicy Bypass -File scripts\run_migrations.ps1            # esquemas *_demo, funções e views
powershell -ExecutionPolicy Bypass -File scripts\run_demo_etl.ps1              # gera, valida e carrega a demo
powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1 -ComReexecucao  # testes e idempotência
```

## Testes

| Parte | Como | Resultado |
|---|---|---|
| Aplicação web | `npm run test` em `web/`: testes unitários e de integração contra um banco de teste próprio (`nobreza_app_teste`), incluindo concorrência e os invariantes de estoque | 214 de 214 aprovados |
| DW real | 14 verificações de qualidade ao fim de cada carga; `tests/dw_real/` (idempotência, ambiente demonstrativo intacto, ausência de nomes de pessoas) | Execução no Azure: 14 de 14, 0 rejeições |
| Ambiente demonstrativo | `scripts\run_tests.ps1` e o verificador estático | 24 de 24 verificações (2026-11-01) |

## Estrutura do repositório

```text
.
├── web/                 # aplicação web (código, migrations, testes)
├── db/migrations/       # DW: esquemas *_demo; real/ para os esquemas reais
├── db/views/            # views de consumo (bi_demo e real/)
├── db/seguranca/        # perfis de leitura
├── etl/sql/demo/        # gerador, validação e cargas do ambiente demonstrativo
├── etl/sql/app/         # ETL do banco operacional para o DW real
├── scripts/             # execução (PowerShell + psql)
├── tests/               # testes SQL, verificador estático, DW real e reconciliação
├── tools/grafana/       # painéis do Grafana e suas consultas SQL
├── tools/powerbi/       # geradores das páginas do relatório demonstrativo (Node.js)
├── powerbi/             # projetos PBIP (demonstrativo; o real é histórico) e guias
└── docs/                # arquitetura, dicionário de dados, ETL, qualidade, indicadores, decisões
    └── app_web/         # especificação da aplicação web
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura: hospedagem no Azure, papéis, firewall, backup, painéis; ambiente demonstrativo |
| [`docs/indicator_catalog.md`](docs/indicator_catalog.md) | Indicadores: pergunta de negócio, fórmula, unidade, período, onde aparece e limitações; indicadores retirados |
| [`docs/etl_runbook.md`](docs/etl_runbook.md) | Como executar o ETL e a evidência da execução no Azure |
| [`docs/etl_mapping.md`](docs/etl_mapping.md) | Mapeamento: planilhas → importação → sistema → ETL → DW |
| [`docs/data_dictionary.md`](docs/data_dictionary.md) | Dicionário de dados do DW |
| [`docs/data_quality.md`](docs/data_quality.md) | Regras para as inconsistências das planilhas e verificações do ETL |
| [`docs/decisions/decision_log.md`](docs/decisions/decision_log.md) | Registro de decisões |
| [`docs/app_web/especificacao.md`](docs/app_web/especificacao.md) | Regras de negócio, invariantes, modelo de dados, telas e importação da aplicação |
| [`docs/source_inventory.md`](docs/source_inventory.md) | Inventário das planilhas de origem (sem dados pessoais) |

## Segurança e privacidade

- Não são versionados: planilhas de origem (`data/raw/`), arquivos derivados (`data/processed/`), documentos de referência, arquivos `.env` (inclusive `.env.dw_azure` e `.env.app_azure`), credenciais, backups e arquivos PBIX.
- Nenhuma parte usa a conta de administrador do PostgreSQL no dia a dia: cada parte tem seu papel, com o mínimo de privilégios (ver [`docs/architecture.md`](docs/architecture.md)).
- O servidor de banco no Azure só aceita conexões dos serviços do Azure, da máquina de administração e dos endereços do Grafana Cloud, sempre com SSL.
- Senhas são guardadas só como hash Argon2id; sessões ficam no servidor, com cookie `HttpOnly`.
- O painel público do Grafana é aberto a quem tiver o link. Por isso nenhuma view do esquema `bi` tem nome de pessoa.
