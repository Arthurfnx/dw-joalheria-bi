-- =============================================================================
-- Nobreza Jóias — papel de leitura para o DW (especificação, seção 6A)
--
-- Cria o papel nobreza_leitura_dw, usado pelo ETL do Data Warehouse. Os
-- privilégios por tabela e por coluna são dados pela migration
-- 0008_privilegios_produto_estoque.sql; por isso este script precisa ser
-- executado ANTES de `npm run db:migrar`.
--
-- Executado uma vez, pelo administrador do PostgreSQL, conectado ao banco
-- postgres. Não apaga nada e falha se o papel já existir.
--
-- Uso (PowerShell, a partir da pasta web/):
--
--   & "$env:PG_BIN\psql.exe" -U postgres -d postgres `
--       -v senha_leitura_dw='...' `
--       -f db/bootstrap/02_criar_papel_leitura_dw.sql
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?senha_leitura_dw}
\else
  \echo 'ERRO: informe a senha do papel nobreza_leitura_dw com -v senha_leitura_dw=...'
  select 1 / 0 as falta_senha_leitura_dw;
\endif

create role nobreza_leitura_dw
  login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  password :'senha_leitura_dw';

-- O banco de teste também recebe a conexão, para os testes provarem o que
-- o papel não consegue ler.
grant connect on database nobreza_app to nobreza_leitura_dw;
grant connect on database nobreza_app_teste to nobreza_leitura_dw;

\echo 'Papel nobreza_leitura_dw criado. Execute agora npm run db:migrar.'
