# Plano de implementação

## Fase 1 — Diagnóstico

- Inspecionar repositório e ambiente.
- Localizar e inventariar fontes reais.
- Documentar campos, datas, volume, granularidade e problemas de qualidade.
- Registrar perguntas que exigem validação do parceiro.

**Saída:** inventário e lista de decisões pendentes.

## Fase 2 — Preparação do ambiente

- Preparar ambiente Python virtual.
- Instalar/configurar PostgreSQL localmente após autorização do usuário.
- Testar conexão e documentar comandos.

**Saída:** ambiente reproduzível.

## Fase 3 — Staging e ingestão

- Implementar extração conforme formato real das fontes.
- Criar staging e auditoria.
- Implementar validações e relatório de rejeições.

**Saída:** fontes reais carregadas em staging.

## Fase 4 — Modelagem dimensional

- Definir granularidade e dimensões conformadas.
- Implementar apenas fatos sustentadas pelas fontes.
- Criar migrations e testes de integridade.

**Saída:** Data Warehouse implementado e documentado.

## Fase 5 — ETL e indicadores

- Implementar transformações SQL e cargas reproduzíveis.
- Validar reconciliação e idempotência.
- Documentar fórmulas, unidades, períodos e limitações.

**Saída:** ETL auditável e catálogo de indicadores.

## Fase 6 — Power BI

- Instalar Power BI Desktop.
- Conectar ao PostgreSQL.
- Criar modelo semântico, medidas e páginas de relatório que os dados suportarem.
- Validar resultados contra o banco.

**Saída:** relatórios validados ou documentação precisa do que ainda impede sua finalização.
