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
- [x] Artefatos do Power BI (DAX, modelo, páginas, conexão, checklist), ainda sem validação.
- [x] Criar o banco `dw_joalheria` (criado pelo usuário em 2026-10-31).
- [x] Aplicar as migrations no PostgreSQL 18.6 (21 arquivos, 0 advertências).
- [ ] Executar ETL e testes; registrar os resultados reais (aguardando autorização).
- [ ] Power BI Desktop instalado pelo usuário; relatório validado contra o SQL.

## Fase 2 — dados reais
- [ ] Respostas do parceiro às perguntas pendentes.
- [ ] Extração Python dos XLSX para esquemas reais.
- [ ] Modelo real e ETL próprio, separados da demo.
