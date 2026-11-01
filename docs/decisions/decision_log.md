# Registro de decisões

| ID | Decisão/declaração | Origem | Status | Consequência |
|---|---|---|---|---|
| D-001 | PostgreSQL será o banco do Data Warehouse | Requisito acadêmico | Definido | Usa-se o PostgreSQL 18.6 local, já instalado |
| D-002 | Power BI é a ferramenta obrigatória de relatórios | Requisito acadêmico | Definido | O DW disponibiliza views em `bi_demo` |
| D-003 | Docker não será usado | Usuário | Definido | Instalação local |
| D-004 | Produtos e estoque têm fonte XLSX | Usuário | **Confirmado por inspeção** (2026-10-31) | Ver `docs/source_inventory.md` |
| D-005 | Fontes de compras e vendas existem | Usuário | **Revisado:** não há arquivos separados; compras e vendas aparecem como colunas da aba FOLHEADOS | Considerar na fase 2 |
| D-006 | O histórico é desconhecido | Usuário | Parcialmente observado: vendas de 2024-10 a 2026-10; lotes de compra de 2025-01 a 2026-06; sem snapshots | Fase 2 |
| D-007 | A fonte real de vendas não possui ID de transação | Usuário | Confirmado por inspeção | Ticket e associação somente com IDs sintéticos na demo |
| D-008 | ETL prioriza SQL; Python para XLSX | Proposta técnica | Definido | Python reservado para a fase 2 |
| D-009 | **A fase 1 usa somente dados sintéticos** (`SINTETICO_DEMO`); as planilhas reais ficam para a fase 2 | Usuário, 2026-10-31 | Definido | Exceção às regras 3 e 5 do `CLAUDE.md`, restrita aos esquemas `*_demo` |
| D-010 | Esquemas exclusivos da demo: `config_demo`, `staging_demo`, `dw_demo`, `bi_demo`, `audit_demo`; nenhum compartilhado com o ambiente real | Usuário | Definido | Os esquemas reais não são criados agora |
| D-011 | O gerador sintético é escrito em SQL/PL/pgSQL, com RNG determinístico baseado em md5 | Proposta aprovada | Definido | Geração e transformação dentro do PostgreSQL; reprodutível entre versões |
| D-012 | Modelo estrela: `dim_produto`, `dim_data`, `dim_tipo_movimentacao`; fatos de compra, venda, movimentação e snapshot; `parametro_preco_ouro` auxiliar | Proposta aprovada | Definido | Ver `docs/data_dictionary.md` |
| D-013 | A movimentação tem uma única medida, `quantidade` (> 0); o sinal vem de `dim_tipo_movimentacao` | Usuário | Definido | Saldo = Σ (quantidade × sinal) |
| D-014 | Tipo `SALDO_INICIAL` incluído | Proposta aprovada | Definido | Os snapshots reconciliam com as movimentações sem inflar as compras |
| D-015 | Venda e compra são ligadas às movimentações por `id_evento_origem` sintético comum; sem relação entre fatos no Power BI | Usuário | Definido | Rastreabilidade sem dupla contagem |
| D-016 | `PREÇO SUGERIDO = preço do ouro 1000 × 1,6 × índice`, somente para Ouro/Prata | Cliente (via usuário) | Regra de negócio confirmada | Folheado mantém o índice sem a fórmula |
| D-017 | O preço do ouro é versionado: correção por nova versão, sem UPDATE/DELETE de valores; entradas guardam `parametro_id` e uma cópia do valor | Usuário | Definido | O histórico não muda retroativamente |
| D-018 | A entrada de Ouro/Prata exige o preço da **mesma data**; sem fallback, a entrada é rejeitada | Usuário | Definido | A série sintética cobre todos os dias |
| D-019 | O preço do ouro sintético tem `unidade_referencia = NAO_CONFIRMADA_DEMO` | Usuário | Definido | Não é cotação oficial; a unidade real está pendente |
| D-020 | Tamanho/Ômega obrigatório somente para Anel; não há restrição de tipo de peça por material | Usuário | Definido | Distribuições configuráveis |
| D-021 | O preço realizado pode ser menor, igual ou maior que o marcado (cenários configuráveis e demonstrativos) | Usuário | Definido | Sem CHECK realizado ≤ marcado |
| D-022 | `perfil_movimentacao_demo` é atributo técnico do gerador, fora de `dim_produto` e dos relatórios | Usuário | Definido | Fica em `staging_demo.produto_perfil_simulacao` |
| D-023 | Margem bruta, estoque valorizado e giro por custo ficam fora da fase 1 | Usuário | Definido | Custo médio ponderado de aquisição ≠ CMV |
| D-024 | Sem dados pessoais e sem dimensão de clientes | Usuário | Definido | Não há relatórios de clientes |
| D-025 | Documentos de referência **copiados** para `docs/referencia/` (originais mantidos) | Usuário | Executado em 2026-10-31 | A pasta segue ignorada pelo Git |
| D-026 | Power BI Desktop será instalado pelo usuário; não há outra instalação de PostgreSQL; os scripts aceitam `PG_BIN` | Usuário | Definido | — |
| D-027 | Operações destrutivas (reset da demo, DROP, TRUNCATE) somente com confirmação explícita a cada execução | Usuário | Definido | `reset_demo.ps1` com confirmação |
| D-028 | O gerador, a validação e a carga ficam em procedures PL/pgSQL; os scripts PowerShell apenas orquestram, uma transação por etapa | Implementação (2026-10-31) | Definido | Etapas auditáveis e reexecutáveis em `audit_demo.etapa` |
| D-029 | Ordenações que influenciam a geração e o hash usam `COLLATE "C"` | Implementação | Definido | O determinismo não depende da collation do banco |
| D-030 | Staging guarda as linhas de cada execução (PK com `id_execucao`); limpeza só pelo reset controlado | Implementação | Definido | Permite comparar o md5 entre execuções (REP-02) sem operações destrutivas no fluxo normal |
| D-031 | Rejeição em cascata: item comercial rejeitado rejeita o movimento correspondente e vice-versa | Implementação | Definido | Evita compra/venda sem movimento (ou o inverso) no DW |
| D-032 | Colunas derivadas declaradas `STORED` (no PostgreSQL 18 o padrão é VIRTUAL) | Implementação | Definido | Valores materializados para o Power BI e para os testes |
| D-033 | O preço sugerido é calculado por uma única função `dw_demo.calcular_preco_sugerido` (regra confirmada), usada no CHECK, na carga e no gerador | Implementação | Definido | Uma única fonte da fórmula × 1,6 |
| D-034 | Para Ouro, o tamanho só é permitido em Anel (CHECK); para Prata/Folheado não há proibição | Regra do usuário ("Ouro: tamanho somente quando for anel") | Definido | `ck_dim_produto_ouro_tamanho` |
| D-035 | Métricas de associação calculadas em SQL sobre o período completo (`vw_associacao_tipos/produtos`) | Implementação | Definido; pode ser revisto | Não respondem ao filtro de data no Power BI |
| D-036 | Scripts `.ps1` em UTF-8 com BOM; o `psql` é decodificado em UTF-8 | Implementação | Definido | Acentos corretos no Windows PowerShell 5.1 |
| D-037 | `Invoke-Psql -Comando` grava o SQL em arquivo temporário UTF-8 sem BOM e executa com `-f` (apagado no `finally`) | Correção após falha de codificação real (2026-10-31) | Definido | Acentos preservados no Windows PowerShell 5.1 |
| D-038 | Registro de migrations em fila até `audit_demo.migracao_aplicada` existir; depois, registro imediato após o sucesso; arquivo com falha não é registrado; advertência para SHA-256 divergente | Correção após falha da primeira execução (2026-10-31) | Definido | Retomada idempotente sem DROP/reset |
| D-039 | O ranking "Top 10 regras de produtos por lift" considera somente regras com `vendas_com_ambos >= 5` | Usuário (aprovado na construção da página 6, 2026-11-01) | Definido | Evita lifts altos baseados em 1 ou 2 vendas; 52 das 3.396 regras entram no ranking |
| D-040 | A comparação entre janelas comerciais e demais datas usa a receita média por dia de calendário (receita do grupo ÷ dias do grupo), não a receita total | Implementação; página 6 aprovada pelo usuário (2026-11-01) | Definido | Compara grupos de tamanhos diferentes (86 × 645 dias no período completo) |
| D-041 | Rankings "Top 10" implementados por medidas próprias (`TOPN` + `ALLSELECTED`), não pelo filtro TopN do visual | Implementação (limitação do PBIR: o filtro TopN só aceita agregação de coluna) | Definido | 4 medidas "… - Top 10 …"; o ranking respeita os filtros da página |
| D-042 | Estoque tratado como semiaditivo: as medidas usam o último snapshot com dados dentro do filtro (`LASTNONBLANK`) | Implementação, conforme a regra de granularidade do snapshot | Definido | Nunca soma saldos ao longo do tempo; `[Data da Posição de Estoque]` mostra a data usada |
| D-043 | Conexão do Power BI fixa em `localhost:5432`, banco `dw_joalheria`, esquema `bi_demo`, sem parâmetros; a parametrização fica como melhoria futura | Usuário (2026-11-01) | Definido | Trocar de ambiente exige editar as 12 consultas; substitui a recomendação anterior de um parâmetro `Esquema` |
| D-044 | Medidas de movimentação calculadas a partir de `fato_movimentacao_estoque` com o sinal da dimensão; medidas por tipo usam `KEEPFILTERS`; o saldo acumulado ignora o filtro de tipo | Implementação; página 5 aprovada pelo usuário (2026-11-01) | Definido | Saldo acumulado em 31/12/2025 = 520 = snapshot; os cartões por tipo respeitam a segmentação de tipo |
| D-045 | A tabela "Janelas comerciais" da página 6 não tem a coluna Ano | Usuário (opção B, 2026-11-01) | Definido | O ano é escolhido pela segmentação; reproduzível por `gerar_pagina_6.js` + `opcao_b_janelas.js` + `renomear_titulo_janelas.js` (ver `tools/powerbi/README.md`) |
| D-046 | Modelo semântico em estrela sobre as views `bi_demo`: sem relacionamento entre fatos, `vw_dim_data` marcada como tabela de datas, data/hora automática desligada, medidas implícitas desencorajadas, todas as medidas na tabela `Medidas`, medidas de exibição em texto com `FORMAT` e tratamento de vazio com `ISBLANK` | Implementação; correções do modelo autorizadas pelo usuário (2026-11-01) | Definido | 50 medidas, 10 relacionamentos (1 inativo), 44 colunas técnicas ocultas |
| D-047 | Perfil `bi_leitura` (somente leitura em `bi_demo`) criado por `db/seguranca/bi_leitura.sql`, fora de `run_migrations.ps1`; ETL e conferências usam `postgres` | Implementação (aplicado em sessão anterior; perfil conferido em 2026-11-01) | Definido. **Pendente de confirmação:** qual usuário está gravado nas credenciais do Power BI Desktop | Aceitável apenas no ambiente demonstrativo local |
| D-048 | O PBIP/PBIR e o TMDL são a fonte da verdade do relatório; `powerbi/measures.dax` é exportado do TMDL; os geradores em `tools/powerbi/` são versionados como registro histórico, não como processo de build | Consolidação técnica (2026-11-01) | Definido | Documentação deriva dos arquivos do PBIP, não do plano original |
| D-049 | A página vazia "Página 1" é auxiliar, não faz parte das seis páginas principais e foi preservada | Usuário (2026-11-01) | Definido. **Pendente de confirmação:** removê-la ou ocultá-la | Nenhuma |
