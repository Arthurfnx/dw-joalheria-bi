# Data Warehouse e Business Intelligence — Joalheria

Projeto acadêmico de Sistemas de Informação para implementar uma solução de Business Intelligence com **PostgreSQL**, **Data Warehouse dimensional**, processos de **ETL** e **Power BI**.

## Objetivo

Consolidar dados disponíveis sobre produtos, estoque, compras e vendas para apoiar análises gerenciais. O foco é a camada analítica; não faz parte do escopo inicial construir um sistema web transacional, módulos financeiros, pagamentos, fornecedores, logística ou e-commerce.

## Situação conhecida do projeto

As informações abaixo foram declaradas pelo usuário, mas as fontes ainda precisam ser inspecionadas:

- Produtos e estoque: fonte em formato XLSX.
- Compras: existe uma fonte; formato, estrutura e campos ainda não inspecionados.
- Vendas: existe uma fonte; formato, estrutura e campos ainda não inspecionados.
- Histórico disponível: período e completude desconhecidos.
- Identificador de transação de venda: informado como inexistente.
- PostgreSQL: ainda não instalado/configurado no computador de desenvolvimento.
- Power BI Desktop: ainda não instalado.
- Docker: não instalado e não previsto para a primeira versão.

Essas informações não autorizam presumir campos, volumes, datas, regras comerciais ou granularidades que não tenham sido observados nas fontes.

## Arquitetura pretendida

**Fontes → Staging no PostgreSQL → ETL (preferencialmente SQL; Python para extração XLSX quando necessário) → Data Warehouse dimensional → Power BI.**

Os esquemas `staging`, `dw` e `audit` são uma proposta inicial a confirmar durante o desenho técnico. Não criar fatos e dimensões sem verificar sua viabilidade nas fontes reais.

## Estrutura do repositório

```text
.
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── docs/
│   ├── decisions/
│   ├── referencia/       # arquivos locais de referência; ignorados pelo Git
│   ├── architecture.md
│   ├── source_inventory.md
│   ├── pending_questions.md
│   ├── data_dictionary.md
│   ├── etl_mapping.md
│   ├── indicator_catalog.md
│   └── implementation_plan.md
├── data/
│   ├── raw/               # fontes comerciais; ignoradas pelo Git
│   └── processed/         # arquivos derivados locais; ignorados pelo Git
├── db/
│   ├── migrations/
│   └── views/
├── etl/
│   ├── python/
│   └── sql/
├── powerbi/
├── prompts/
├── scripts/
└── tests/
```

## Segurança e versionamento

- Não versionar planilhas reais, dados de clientes, documentos comerciais privados, backups de banco, `.env` ou credenciais.
- Colocar fontes locais em `data/raw/`. Essa pasta é ignorada pelo Git.
- Colocar documentos de referência locais em `docs/referencia/`. Essa pasta é ignorada pelo Git.
- O arquivo `.env.example` contém apenas nomes de variáveis e valores ilustrativos; nunca coloque credenciais reais nele.
- Antes de cada commit, revisar `git status` e o conteúdo que será enviado.

## Próximos passos

1. Abrir este repositório no Claude Code.
2. Pedir a inspeção do repositório e do ambiente, seguindo `CLAUDE.md`.
3. Disponibilizar localmente os arquivos XLSX de produtos/estoque, compras e vendas em `data/raw/`, sem enviá-los ao GitHub.
4. Inspecionar as fontes e documentar campos, volume, datas, qualidade e granularidade.
5. Definir o modelo dimensional com base nos dados observados.
6. Instalar/configurar PostgreSQL e Power BI Desktop seguindo as instruções que forem aprovadas.
7. Implementar staging, ETL, Data Warehouse, testes e relatórios gradualmente.

## Primeira solicitação ao Claude Code

Use o texto de `prompts/primeira_execucao.md`. O Claude Code deve começar pelo diagnóstico, não pela criação automática de um modelo presumido.
