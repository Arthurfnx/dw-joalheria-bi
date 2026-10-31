# Arquitetura proposta

## Fluxo lógico

**Fontes reais → staging PostgreSQL → ETL → Data Warehouse dimensional PostgreSQL → Power BI.**

## Componentes

1. **Fontes:** arquivos XLSX/CSV ou outras fontes efetivamente identificadas para produtos/estoque, compras e vendas.
2. **Extração:** Python pode ser usado para ler XLSX e carregar dados em staging. Para CSV, avaliar `COPY`/`\copy` do PostgreSQL.
3. **Staging:** recepção dos dados de origem, preservando rastreabilidade e sem assumir que a fonte seja um sistema operacional.
4. **ETL:** priorizar SQL no PostgreSQL para padronização, validação, transformação e carga; Python somente quando necessário à extração.
5. **Data Warehouse:** modelo dimensional em PostgreSQL, definido após inspeção das fontes e confirmação das granularidades.
6. **Auditoria:** registrar lotes, quantidades processadas, rejeições e falhas.
7. **Power BI:** consumir tabelas ou visões analíticas do DW. O Power BI não substitui o ETL.

## Decisões ainda abertas

- Nomes finais dos esquemas e banco.
- Estratégia de carga inicial e incremental.
- Fatos e dimensões implementáveis.
- Frequência de atualização.
- Modo de conexão do Power BI (Import ou DirectQuery).

Não presumir dados históricos ou fontes operacionais que ainda não foram confirmados.
