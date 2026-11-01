# Checklist de implementação

## Fase 1 — demonstrativa
- [x] Inspecionar o repositório, o `git status` e o ambiente.
- [x] Inventariar as fontes reais (para a fase 2), sem modificá-las.
- [x] Aprovar a arquitetura, o modelo e as regras da demo (plano v3.1).
- [x] Copiar os documentos de referência para `docs/referencia/`.
- [x] Atualizar a documentação (README, CLAUDE, arquitetura, especificação, dicionário, ETL, qualidade, indicadores, decisões e pendências).
- [x] Migrations dos esquemas `*_demo` (código).
- [x] Gerador determinístico e configuração (código).
- [x] Validação, cargas, snapshots e auditoria (código).
- [x] Views `bi_demo` (código).
- [x] Scripts PowerShell e testes SQL (código; validação estática aprovada).
- [x] Planejamento dos artefatos do Power BI (modelo, páginas, conexão, checklist).
- [x] Criar o banco `dw_joalheria` (criado pelo usuário em 2026-10-31).
- [x] Aplicar as migrations no PostgreSQL 18.6 (21 arquivos, 0 advertências).
- [x] Executar o ETL e os testes (execuções 2 e 3: SUCESSO, 24/24; REP-01 e REP-02 aprovados).
- [x] Criar o perfil `bi_leitura` e validar que não tem escrita.
- [x] Power BI Desktop instalado pelo usuário; modelo semântico ajustado (50 medidas, 10 relacionamentos).
- [x] Seis páginas do relatório construídas e aprovadas pelo usuário (2026-11-01).
- [x] Indicadores do relatório conferidos contra o SQL (`tests/reconciliacao/`, `powerbi/validation_checklist.md`).
- [x] Consolidação técnica: documentação, `measures.dax` exportado do TMDL, ferramentas versionadas (2026-11-01).
- [ ] Confirmar qual usuário está gravado nas credenciais do Power BI Desktop (`bi_leitura` é o previsto).

## Melhorias futuras da fase 1 (não implementadas)
- [ ] Parametrizar servidor, banco e esquema nas consultas do Power BI.
- [ ] Automatizar a comparação DAX × SQL (hoje manual).
- [x] Reproduzir a página 6 a partir das ferramentas (gerador + 2 ajustes; conferido numa cópia em 2026-11-01).

## Fase 2 — dados reais
- [ ] Respostas do parceiro às perguntas pendentes.
- [ ] Extração Python dos XLSX para esquemas reais.
- [ ] Modelo real e ETL próprio, separados da demo.
