# Runbook do ETL — ambiente demonstrativo

**Status:**
- Scripts e SQL **implementados e validados apenas estaticamente**: verificador SQL próprio e parser do PowerShell.
- **Ainda não executados no banco.** O banco `dw_joalheria` ainda não foi criado e as migrations não foram aplicadas. Este documento será complementado com saídas reais após a primeira execução autorizada.

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
| 7 | Power BI | `powerbi/connection_guide.md` | Não |

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
