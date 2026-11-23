# Runbook do ETL

Duas cargas independentes, que não compartilham esquemas:

- **ETL real (Azure):** banco operacional da aplicação → Data Warehouse real. Em uso.
- **ETL do ambiente demonstrativo (histórico):** gerador de dados sintéticos → esquemas `*_demo`, executado localmente na fase 1. Mantido abaixo, sem alteração.

## ETL real (Azure)

Leva os dados do banco operacional `nobreza_app` (esquema `app`) para os esquemas `staging`, `dw`, `bi` e `audit` do banco `dw_joalheria`, os dois no servidor PostgreSQL do Azure (`nobreza-dw.postgres.database.azure.com`). Detalhes técnicos e mapeamento em `etl/sql/app/README.md`.

### Pré-requisitos

- Estrutura do DW criada por `scripts\run_migrations_real.ps1` (idempotente).
- Arquivo local `.env.dw_azure`, ignorado pelo Git, com:
  - DW: `PGHOST`, `PGPORT`, `PGDATABASE` (`dw_joalheria`), `PGUSER` (`dw_carga`), `PGPASSWORD`, `PGSSLMODE`;
  - origem: `APP_PGHOST`, `APP_PGPORT`, `APP_PGDATABASE` (`nobreza_app`), `APP_PGUSER` (`nobreza_leitura_dw`), `APP_PGPASSWORD`, `APP_PGSSLMODE` (SSL da conexão de origem);
  - `PG_BIN`, se o `psql` não estiver no PATH.
- O endereço IP da máquina de administração liberado no firewall do servidor.

### Comando

```powershell
$env:DW_ARQUIVO_ENV='<caminho do .env.dw_azure>'; powershell -ExecutionPolicy Bypass -File scripts\run_etl_app.ps1
```

`DW_ARQUIVO_ENV` escolhe outro arquivo `.env` no lugar do `.env` da raiz, que continua servindo o DW local e o ambiente demonstrativo. Código de saída: 0 = SUCESSO; 1 = erro; 2 = verificação de qualidade reprovada.

### Etapas

| Etapa | Efeito |
|---|---|
| 1. Conferência do papel de origem | Recusa a execução se o papel de origem for superusuário ou puder ler `consignado_com`, `local_original` ou `app.usuario` |
| 2. `audit.iniciar_execucao()` | Abre a execução e devolve o seu número |
| 3. Extração | Lê `nobreza_app` numa transação REPEATABLE READ e grava CSV em `data/processed/etl_app/` (ignorada pelo Git), com a contagem de linhas de cada tabela de origem |
| 4. Staging | `staging.esvaziar()` e cópia de cada CSV, com conferência do cabeçalho |
| 5. Validação | `staging.validar_staging(id)`: registros inválidos vão para `audit.rejeicao` com o motivo; nada é descartado em silêncio |
| 6. Carga | `dw.carregar(id)`: recarga completa das dimensões, dos fatos e do retrato diário de estoque |
| 7. Qualidade | `audit.executar_verificacoes(id)`: 14 verificações em `audit.resultado_validacao`; qualquer reprovação encerra a execução como FALHA |
| 8. Encerramento | `audit.finalizar_execucao(id, SUCESSO ou FALHA)`; `audit.etapa` guarda lidas, carregadas e rejeitadas por tabela |

### Evidência de execução no Azure

Execução nº 2 do DW real no Azure, em 22/11/2026: **SUCESSO, 0 rejeições, 14 de 14 verificações aprovadas.** Números da saída do ETL:

| Tabela de destino | Origem | Lidas | Carregadas | Rejeitadas |
|---|---|---|---|---|
| `dw.dim_produto` | `app.produto` | 2.669 | 2.669 | 0 |
| `dw.fato_movimentacao_estoque` | `app.movimentacao_estoque` | 2.458 | 2.458 | 0 |
| `dw.fato_venda_item` (origem PLANILHA) | `app.venda_historica` | 110 | 110 | 0 |
| `dw.fato_compra_item` | produtos com data de aquisição | 690 | 690 | 0 |
| `dw.dim_data` | calendário gerado pela carga | — | 1.057 | — |
| `dw.fato_snapshot_estoque` | saldos derivados das movimentações | — | 2.669 | — |

O retrato de estoque tem uma linha por produto e por dia, da data da importação até a data de referência da carga; nesta execução, um dia. As vendas registradas no sistema entram em `dw.fato_venda_item` com origem APLICACAO a partir da primeira venda confirmada.

Verificações aprovadas (14 de 14):

| Código | Verificação |
|---|---|
| QLD-01 | Contagem da origem = contagem do staging, por tabela |
| QLD-02 | Produtos do DW = produtos da origem |
| QLD-03 | Vendas de origem PLANILHA = `venda_historica` |
| QLD-04 | Itens e vendas da aplicação (só confirmadas) |
| QLD-05 | Compras = peças com data de aquisição |
| QLD-06 | Movimentações e preço do ouro |
| EST-01 | Retrato do último dia = saldo da aplicação |
| EST-02 | Σ movimentações = saldo (invariante I2) |
| EST-03 | Retratos só a partir da importação |
| ORF-01 | Nenhuma linha órfã |
| VDA-01 | Vendas simbólicas fora do faturamento |
| VDA-02 | Associação só com vendas da aplicação |
| PRC-01 | Preço sugerido = regra RN-68 |
| PRV-01 | Nenhuma coluna de pessoa em `staging`, `dw` e `bi` |

Para conferir uma execução, com o papel de carga (o papel `bi_leitura` não lê `audit`):

```sql
SELECT id_execucao, status, mensagem FROM audit.execucao ORDER BY id_execucao DESC LIMIT 5;
SELECT codigo, aprovado, obtido FROM audit.resultado_validacao
 WHERE id_execucao = (SELECT max(id_execucao) FROM audit.execucao) ORDER BY codigo;
SELECT * FROM audit.etapa   WHERE id_execucao = (SELECT max(id_execucao) FROM audit.execucao);
SELECT * FROM audit.rejeicao WHERE id_execucao = (SELECT max(id_execucao) FROM audit.execucao);
```

### Reexecução

- Basta repetir o comando. Cada execução esvazia e recarrega `staging`, `dw` e `bi` com o estado atual da aplicação; `audit` só recebe inserções e guarda o histórico de todas as execuções.
- Uma execução com FALHA fica registrada em `audit.execucao` com a mensagem; corrija a causa e repita o comando. Como a recarga é completa, a nova execução substitui o conteúdo de `staging`, `dw` e `bi`.
- Depois da carga, a tela Relatórios e o Grafana passam a mostrar a nova data de referência, sem outra ação.
- Os esquemas `*_demo` nunca são lidos nem alterados.

---

# ETL do ambiente demonstrativo (histórico)


**Status:** executado no PostgreSQL 18.6 local (banco `dw_joalheria`) em 2026-10-31. Resultados em "Execuções registradas".

## Execuções registradas (`audit_demo.execucao`, conferido em 2026-11-01)

| Execução | Início | Status | Verificações | Observação |
|---|---|---|---|---|
| 1 | 31/10/2026 21:20 | FALHA | — | Erro do PostgreSQL "não é possível usar subconsulta no argumento do CALL" em uma etapa do script; corrigido antes da execução 2. Registro preservado na auditoria |
| 2 | 31/10/2026 23:53 | SUCESSO | 24/24 aprovadas | Primeira carga do DW |
| 3 | 31/10/2026 23:59 | SUCESSO | 24/24 aprovadas, incluindo REP-01 e REP-02 | Reexecução (`run_tests.ps1 -ComReexecucao`): nada novo no DW, mesmo conteúdo |

- `audit_demo.rejeicao`: 0 linhas.
- `audit_demo.migracao_aplicada`: 21 arquivos (7 de `db/migrations`, 13 de `etl/sql/demo`, 1 de `db/views`), aplicados em 31/10/2026 às 23:52.
- Um único hash de configuração registrado (a configuração padrão não foi alterada).

Contagens no DW após a execução 3:

| Tabela | Linhas |
|---|---|
| `dw_demo.dim_data` | 731 |
| `dw_demo.dim_produto` | 150 |
| `dw_demo.dim_tipo_movimentacao` | 7 |
| `dw_demo.parametro_preco_ouro` | 731 |
| `dw_demo.fato_venda_item` | 6.370 |
| `dw_demo.fato_compra_item` | 1.789 |
| `dw_demo.fato_movimentacao_estoque` | 8.377 |
| `dw_demo.fato_snapshot_estoque` | 3.600 |

O staging acumula as duas execuções bem-sucedidas (por exemplo, 12.740 linhas em `staging_demo.venda_gerada`, 2 × 6.370). Isso é o comportamento previsto (D-030), não duplicidade no DW.

O perfil `bi_leitura` foi criado com `db/seguranca/bi_leitura.sql`, aplicado separadamente: esse arquivo **não** faz parte de `run_migrations.ps1`. A senha foi cadastrada manualmente, fora do repositório.

## Pré-requisitos
- PostgreSQL 18.6 já instalado, com o serviço `postgresql-x64-18` em execução. **Não instalar outra versão.**
- `.env` local, copiado de `.env.example` e nunca versionado:
  - `PGHOST`, `PGPORT`, `PGDATABASE=dw_joalheria`, `PGUSER`, `PGPASSWORD`;
  - `PG_BIN=C:\Program Files\PostgreSQL\18\bin`, quando o `psql` não estiver no PATH. Os scripts procuram primeiro em `PG_BIN` e depois no PATH.
- Executar a partir da raiz do repositório, no PowerShell:
  `powershell -ExecutionPolicy Bypass -File scripts\<script>.ps1`.

## Sequência

| Passo | Comando | Efeito | Altera o banco? |
|---|---|---|---|
| 0 | `python tests\estatico\verificar_sql.py` | Validação estática dos SQL | Não |
| 1 | `scripts\criar_banco.ps1` | `CREATE DATABASE` de `PGDATABASE`, se não existir (pede confirmação) | **Sim** (cria o banco) |
| 2 | `scripts\run_migrations.ps1 -SomenteListar` | Lista os arquivos que serão aplicados | Não |
| 3 | `scripts\run_migrations.ps1` | Aplica `db/migrations`, `etl/sql/demo` e `db/views` (idempotente) e registra em `audit_demo.migracao_aplicada` | Sim (estruturas e configuração padrão) |
| 4 | `scripts\run_demo_etl.ps1` | Executa o ETL completo; código de saída 0 = SUCESSO, 2 = verificações reprovadas, 1 = erro | Sim (dados sintéticos) |
| 5 | `scripts\run_tests.ps1` | Testes SQL (cada arquivo com ROLLBACK) | Não |
| 6 | `scripts\run_tests.ps1 -ComReexecucao` | Reexecuta o ETL e confirma idempotência (REP-01) e determinismo (REP-02) | Cria uma nova execução de auditoria e novas linhas de staging |
| 7 | `db/seguranca/bi_leitura.sql` (aplicar com `psql -f`, uma vez) | Cria o perfil de leitura do Power BI | Sim (papel e permissões) |
| 8 | Power BI | `powerbi/connection_guide.md` | Não |
| 9 | `tests\reconciliacao\*.ps1` | Conferência dos indicadores do relatório (ver `tests/reconciliacao/README.md`) | Não (READ ONLY + ROLLBACK) |

## Etapas internas de `run_demo_etl.ps1`
Cada etapa é uma chamada `psql` em transação própria:
1. `audit_demo.iniciar_execucao()`
2. `audit_demo.verificar_configuracao(id)`:
   - valida `config_demo`;
   - calcula o hash da configuração;
   - recusa a execução se o DW tiver vindo de outra configuração.
3. `staging_demo.gerar_demo(id)`: catálogo, série sintética do ouro e simulação diária.
4. `staging_demo.validar_staging(id)`: rejeições em `audit_demo.rejeicao`, inclusive em cascata (item comercial ↔ movimento).
5. `dw_demo.carregar_dimensoes(id)`: `dim_data`, `dim_produto`, `parametro_preco_ouro` (versão 1 somente para datas sem preço).
6. `dw_demo.carregar_fatos(id)`: compras (com o preço do ouro vigente da mesma data), vendas e movimentações. Usa `ON CONFLICT (id_evento_origem) DO NOTHING`.
7. `dw_demo.gerar_snapshots(id)`: fim de cada mês + `data_fim`, para todos os produtos.
8. `audit_demo.executar_verificacoes(id)`: 24 verificações em `audit_demo.resultado_validacao`.
9. `audit_demo.finalizar_execucao(id, SUCESSO|FALHA, mensagem)`.

Em caso de erro, o script registra `FALHA` com a mensagem e para.

## Reexecução e reset
- **Mesma configuração:** `run_demo_etl.ps1` gera de novo em staging (nova execução), não insere nada novo no DW e confirma o mesmo conteúdo (REP-01/REP-02).
- **Configuração alterada** (`config_demo`): a etapa 2 falha e orienta o reset.
- **`scripts\reset_demo.ps1`: DESTRUTIVO, sobre dados sintéticos.**
  - Mostra as contagens e exige digitar `LIMPAR AMBIENTE DEMO`.
  - Faz `TRUNCATE ... RESTART IDENTITY` em `staging_demo` e `dw_demo`, exceto `dim_tipo_movimentacao`.
  - Preserva `config_demo` e o histórico de `audit_demo`.
  - **Executar somente com autorização explícita.**

## Preço do ouro (manual)
- **Registrar** uma data sem preço: `scripts\registrar_preco_ouro.ps1 -Data AAAA-MM-DD -Valor N`.
- **Corrigir** um preço: `scripts\registrar_preco_ouro.ps1 -Data AAAA-MM-DD -Valor N -Motivo "texto"`.
  - Cria a versão N+1 e desativa a anterior.
  - Entradas já registradas mantêm a versão e o valor que usaram.
  - Na demo, a unidade é `NAO_CONFIRMADA_DEMO`.

## Verificação após a execução
```sql
SELECT id_execucao, status, mensagem FROM audit_demo.execucao ORDER BY id_execucao DESC LIMIT 5;
SELECT codigo, aprovado, obtido FROM audit_demo.resultado_validacao
 WHERE id_execucao = (SELECT max(id_execucao) FROM audit_demo.execucao) ORDER BY codigo;
SELECT * FROM audit_demo.rejeicao WHERE id_execucao = (SELECT max(id_execucao) FROM audit_demo.execucao);
```

## Observações técnicas
- O `psql` roda com `-X` (ignora `psqlrc`) e `ON_ERROR_STOP=1`; os NOTICEs são exibidos sem interromper.
- Os comandos SQL avulsos (`Invoke-Psql -Comando`) são gravados em um arquivo temporário UTF-8 sem BOM, executados com `-f` e apagados no `finally`. Isso é necessário porque o Windows PowerShell 5.1 converte argumentos `-c` para ANSI (cp1252) e corrompe os acentos.
- Registro de migrations (`audit_demo.migracao_aplicada`):
  - os arquivos executados antes de a tabela existir (a `001`) são registrados logo depois que a `002` a cria;
  - os demais são registrados imediatamente após o sucesso;
  - um arquivo que falha não é registrado;
  - um SHA-256 diferente do registrado gera advertência.
  - Uma execução interrompida é retomada simplesmente reexecutando `run_migrations.ps1`, porque os arquivos são idempotentes.
- Os scripts `.ps1` estão em UTF-8 com BOM, exigência do Windows PowerShell 5.1 para os acentos.
- As tabelas de staging acumulam as linhas de cada execução (chave `id_execucao`) e só são limpas pelo reset controlado.
- Os testes negativos consomem valores de sequência (identity) mesmo com ROLLBACK. Isso é inofensivo; o reset reinicia as sequências.
