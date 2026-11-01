# Plano de implementação

Plano aprovado (v3.1) em 2026-10-31. Detalhes em `docs/architecture.md`, `docs/demo_data_specification.md`, `docs/data_dictionary.md` e `docs/data_quality.md`.

## Fase 1 — Ambiente demonstrativo (dados sintéticos)

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1.0 | Diagnóstico do repositório, do ambiente e das fontes reais | Concluída (somente leitura) |
| 1.1 | Copiar os documentos de referência para `docs/referencia/`; atualizar a documentação | Concluída |
| 1.2 | Migrations: esquemas `*_demo`, auditoria, configuração, staging, dimensões, fatos e parâmetro do ouro | **Aplicadas em `dw_joalheria` (PostgreSQL 18.6) em 2026-10-31**; 21 arquivos registrados |
| 1.3 | Gerador determinístico PL/pgSQL e configuração padrão | Código pronto (`etl/sql/demo/00`–`14`) |
| 1.4 | Validação, cargas, snapshots e qualidade (`etl/sql/demo/`) | Código pronto (`20`–`40`) |
| 1.5 | Views `bi_demo` (incluindo associação e informação do ambiente) | Código pronto (`db/views/bi_demo_views.sql`) |
| 1.6 | Scripts PowerShell (`PG_BIN`) e testes SQL; execução no PostgreSQL 18.6 local | Scripts e testes prontos e validados estaticamente; **execução aguardando autorização para criar o banco** |
| 1.7 | Power BI: `measures.dax`, modelo, páginas, guia de conexão e checklist | Documentos prontos; DAX não validado |
| 1.8 | Montagem e validação do relatório no Power BI Desktop | Depende da instalação pelo usuário |

## Fase 2 — Integração das fontes reais (futura)

- Python (`etl/python/`) para ler CLS, RAMON e FOLHEADOS em esquemas reais próprios de staging.
- Tratamentos documentados em `docs/source_inventory.md`, depois de respondidas as perguntas de `docs/pending_questions.md`.
- DW real separado da demo. O Power BI troca de ambiente por parâmetro de esquema.
