# Qualidade de dados e critérios de validação — ambiente demonstrativo

**Status:** implementado e executado no banco (execuções 2 e 3: 24/24 verificações aprovadas, 0 rejeições). Os critérios estão em dois lugares:
- `etl/sql/demo/40_verificacoes_qualidade.sql`: função `audit_demo.executar_verificacoes(id)`, com 24 verificações gravadas em `audit_demo.resultado_validacao` a cada execução;
- `tests/sql/01..08_*.sql`: testes independentes que falham com exceção. Cada arquivo roda em `BEGIN ... ROLLBACK` e inclui testes negativos (inserções inválidas devem falhar).

Validação estática sem banco: `python tests/estatico/verificar_sql.py`.

## Auditoria (`audit_demo`)

| Tabela | Conteúdo |
|---|---|
| `execucao` | id, início, fim, status, semente, hash da configuração, usuário do banco |
| `etapa` | execução, etapa, linhas lidas, carregadas e rejeitadas, duração |
| `rejeicao` | execução, tabela de origem, chave do registro, regra violada, valor observado (inclui rejeição em cascata item comercial ↔ movimento) |
| `resultado_validacao` | execução, código da verificação, descrição, valor esperado, valor obtido, aprovado |
| `correcao_preco_ouro` | data, versão anterior, nova versão, motivo, momento |
| `reset_registro` | cada reset controlado da demo |
| `migracao_aplicada` | arquivos SQL aplicados e seu SHA-256 |

Nenhum registro inválido é descartado em silêncio.

## Verificações

| Código | Grupo | Regra |
|---|---|---|
| EST-01 | Estrutura | As cinco schemas `*_demo` existem; nenhum esquema real (`staging`, `dw`, `bi`, `audit`) foi criado |
| EST-02 | Estrutura | PKs, FKs, UNIQUEs e CHECKs previstos existem |
| CAT-01 | Catálogo | Todo Ouro tem `peso_g` > 0 |
| CAT-02 | Catálogo | Todo Folheado tem `peso_g` NULL |
| CAT-03 | Catálogo | Todo Anel tem tamanho; nenhum outro tipo é obrigado a ter tamanho |
| CAT-04 | Catálogo | `indice_precificacao` > 0; código no padrão `DEMO-<MATERIAL>-NNNN` |
| PRC-01 | Preço | Um parâmetro vigente por dia do período, com `unidade_referencia = 'NAO_CONFIRMADA_DEMO'` |
| PRC-02 | Preço | Toda compra de Ouro/Prata referencia parâmetro **da mesma data**; Folheado sem parâmetro |
| PRC-03 | Preço | `preco_sugerido_unitario` = preço do ouro aplicado × 1,6 × índice aplicado (Ouro/Prata); NULL para Folheado |
| PRC-04 | Preço | Uma correção cria a versão N+1 e não altera compras já registradas *(somente em `tests/sql/03_preco_ouro.sql`)* |
| PRC-05 | Preço | UPDATE/DELETE indevidos no parâmetro são bloqueados pelo trigger *(somente em teste)* |
| MOV-01 | Movimentação | `quantidade` > 0 em todas as linhas; o sinal vem apenas de `dim_tipo_movimentacao` |
| MOV-02 | Movimentação | Item de venda ↔ SAIDA_VENDA em 1:1 por `id_evento_origem`, com produto, data e quantidade iguais |
| MOV-03 | Movimentação | Item de compra ↔ ENTRADA_COMPRA em 1:1, com as mesmas igualdades |
| MOV-04 | Movimentação | Não há SAIDA_VENDA sem item de venda; presente, roubo e ajuste não estão em `fato_venda_item` |
| SNP-01 | Snapshot | Único por (produto, data); todos os produtos em todas as datas |
| SNP-02 | Snapshot | `quantidade_em_estoque` = Σ(quantidade × sinal) acumulado até o fim da data |
| SNP-03 | Snapshot | `quantidade_em_estoque` ≥ 0; o último snapshot é igual ao saldo final do gerador |
| COM-01 | Comercial | Preço realizado > 0, sem limite em relação ao marcado; a diferença é calculada nos dois sentidos |
| COM-02 | Comercial | As proporções de vendas abaixo, iguais e acima do marcado estão dentro da tolerância configurada |
| COM-03 | Comercial | Faturamento = Σ `valor_realizado_total` |
| SEP-01 | Separação | 100% das linhas de `dw_demo` com `origem_dado = 'SINTETICO_DEMO'` |
| SEP-02 | Separação | `bi_demo` não expõe `perfil_movimentacao_demo` |
| REP-01 | Reprocessamento | O conteúdo gerado nesta execução existe no DW sem divergência, e o DW não tem registros alheios. `run_tests.ps1 -ComReexecucao` confirma que as contagens não mudam |
| REP-02 | Reprocessamento | O md5 do conteúdo gerado é igual ao da última execução bem-sucedida com o mesmo hash de configuração (na primeira execução: N/A, aprovado) |
| REJ-01 | Qualidade | Nenhuma rejeição na geração demonstrativa (uma rejeição indica defeito do gerador) |
| PBI-01 | Power BI | Após a instalação pelo usuário: totais do `powerbi/validation_checklist.md` iguais às consultas SQL; aviso em todas as páginas |

## Resultados

**Validação estática** (2026-10-31): `verificar_sql.py` analisou 29 arquivos SQL sem problemas. Um teste de mutação com 5 erros injetados (parêntese, objeto inexistente, variável ambígua, procedure sem CALL, coluna inexistente) teve os 5 detectados. O parser do PowerShell 5.1 não encontrou erros de sintaxe nos 7 scripts.

**Execução no banco** (2026-10-31, PostgreSQL 18.6, `dw_joalheria`):
- execução 2: SUCESSO, 24/24 verificações aprovadas;
- execução 3 (`run_tests.ps1 -ComReexecucao`): SUCESSO, 24/24, incluindo REP-01 (idempotência) e REP-02 (determinismo);
- `audit_demo.rejeicao`: 0 linhas.

A execução 1 falhou antes das verificações, por erro de sintaxe num `CALL`, corrigido em seguida (ver `docs/etl_runbook.md`).
