# Registro de decisões

| ID | Decisão/declaração | Origem | Status | Consequência |
|---|---|---|---|---|
| D-001 | PostgreSQL será o banco do Data Warehouse | Requisito acadêmico informado | Definido | Implementação deverá usar PostgreSQL |
| D-002 | Power BI será a ferramenta obrigatória de relatórios | Requisito acadêmico informado | Definido | DW deverá disponibilizar tabelas/visões para o Power BI |
| D-003 | Docker não será usado na primeira versão | Ambiente informado pelo usuário | Definido para início | Preparar instalação local |
| D-004 | Produtos/estoque têm fonte XLSX | Informação do usuário | Declarado; arquivo a inspecionar | Inspecionar abas, campos e registros |
| D-005 | Fontes de compras e vendas existem | Informação do usuário | Declarado; arquivos a inspecionar | Identificar formato e granularidade |
| D-006 | Histórico ainda é desconhecido | Informação do usuário | Pendente de investigação | Não prometer sazonalidade/evolução histórica ainda |
| D-007 | Fonte de vendas não possui ID de transação | Informação do usuário | Declarado; inspecionar campos alternativos | Não calcular cesta de produtos nem ticket por transação sem agrupamento confiável |
| D-008 | ETL priorizará SQL; Python poderá extrair XLSX | Proposta técnica | A validar após inspeção | Evitar ferramenta ETL externa sem necessidade |
