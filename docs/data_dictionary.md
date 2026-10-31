# Dicionário de dados

**Status:** não preencher com tabelas presumidas. Criar o dicionário definitivo após aprovação do modelo dimensional baseado nas fontes reais.

Para cada tabela, documentar:

- Nome técnico e nome descritivo.
- Finalidade e tipo (fato/dimensão/staging/auditoria).
- Granularidade (para fatos).
- Origem e regra de atualização.

Para cada coluna, documentar:

- Nome e definição semântica.
- Tipo PostgreSQL e precisão/escala.
- PK, FK, unicidade e nulabilidade.
- Regra de preenchimento e domínio.
- Fonte de origem e transformação ETL.
- Histórico e exemplo, quando pertinente (exemplos fictícios devem ser rotulados).
