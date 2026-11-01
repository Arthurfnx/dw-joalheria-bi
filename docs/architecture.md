# Arquitetura

**Status:** aprovada para a fase 1 (demonstrativa) em 2026-10-31. Ainda não implementada.

## Fluxo lógico — fase 1 (dados sintéticos)

```
config_demo   parâmetros da simulação, semente, distribuições, fatores sintéticos
     │
     ▼  gerador determinístico em PL/pgSQL
staging_demo  registros sintéticos brutos por execução
     │  validação SQL ──► audit_demo.rejeicao
     ▼  transformação e carga SQL
dw_demo       dimensões, fatos e parametro_preco_ouro (esquema estrela)
     │
     ▼
bi_demo       views de consumo ──► Power BI (modo Import)

audit_demo    execuções, etapas, contagens, rejeições e resultados de validação (somente demo)
```

## Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Configuração | `config_demo` (tabelas) | Semente, período, volumes, distribuições, fatores sazonais e afinidades (sintéticos) |
| Gerador | PL/pgSQL | Gera catálogo, série sintética do preço do ouro e simulação diária de estoque, compras e vendas, de forma determinística |
| Staging | `staging_demo` | Recebe os registros gerados, com `id_execucao` |
| Validação | SQL | Regras de domínio, material, preço e referências; rejeições registradas, nunca descartadas em silêncio |
| DW | `dw_demo` | Dimensões, fatos e parâmetro de preço do ouro versionado |
| Consumo | `bi_demo` | Views estáveis para o Power BI, incluindo associação de pares e informação do ambiente |
| Auditoria | `audit_demo` | Execução, etapas, contagens, rejeições, validações e correções de preço |
| Orquestração | PowerShell + `psql` | `scripts/*.ps1`; leem `PG*` e `PG_BIN` do `.env` local |
| Apresentação | Power BI Desktop (Import) | Modelo semântico, medidas DAX e páginas; instalado pelo usuário |

## Decisões de arquitetura

- **PostgreSQL 18.6 local**, já instalado. Um único banco (`PGDATABASE`), com separação por esquemas.
- **Gerador em SQL/PL/pgSQL:** geração, validação e transformação ficam dentro do PostgreSQL, num único lugar auditável e reproduzível. O Python fica reservado para a importação de XLSX na fase 2.
- **Determinismo:** uma função própria baseada em `md5(semente, fluxo, n)` substitui `random()`, cujo algoritmo pode mudar entre versões.
- **Sem ferramentas externas** de ETL ou orquestração (Airflow, dbt, Docker), por não haver necessidade técnica demonstrada.
- **Power BI em modo Import:** o volume é pequeno e permite validação reproduzível contra o SQL.
- **Esquema estrela:** fatos separados por processo e dimensões conformadas (`dim_produto`, `dim_data`). Não há relação entre fatos no modelo semântico.

## Separação entre demo e ambiente real

| Aspecto | Fase 1 (demo) | Fase 2 (real, futura) |
|---|---|---|
| Esquemas | `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo` | esquemas próprios (por exemplo, `staging`, `dw`, `bi`, `audit`), **não criados agora** |
| Origem | gerador sintético | XLSX reais (Python → staging) e, futuramente, sistema operacional |
| Marcação | `origem_dado = 'SINTETICO_DEMO'` | identificação da fonte real |
| Power BI | parâmetro de esquema = `bi_demo` e aviso fixo | parâmetro = esquema real |

As views reais futuras devem manter os mesmos nomes de colunas das views demo, para que o relatório troque de ambiente apenas pelo parâmetro. Dados demo e reais nunca são unidos.

## Fora do escopo

Sistema web transacional, pagamentos, financeiro, fornecedores, logística, frete, e-commerce, clientes, previsão de demanda, margem bruta, estoque valorizado e giro por custo.
