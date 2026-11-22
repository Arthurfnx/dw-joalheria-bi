-- =============================================================================
-- Nobreza Jóias — bootstrap do banco operacional
--
-- Cria os papéis nobreza_migracao e nobreza_aplicacao e os bancos nobreza_app
-- e nobreza_app_teste. Deve ser executado UMA vez, pelo administrador do
-- PostgreSQL (por exemplo, o usuário postgres), conectado ao banco postgres.
-- A aplicação nunca usa a conta de administrador.
--
-- O script não apaga nada: se qualquer papel ou banco já existir, ele para
-- com erro na primeira instrução que falhar.
--
-- Uso (PowerShell, a partir da pasta web/):
--
--   & "$env:PG_BIN\psql.exe" -U postgres -d postgres `
--       -v senha_migracao='...' -v senha_aplicacao='...' `
--       -f db/bootstrap/01_criar_bancos_e_papeis.sql
--
-- As senhas chegam por variável do psql e não ficam em arquivo. Use senhas
-- diferentes para os dois papéis e repita-as em web/.env.
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?senha_migracao}
\else
  \echo 'ERRO: informe a senha do papel nobreza_migracao com -v senha_migracao=...'
  select 1 / 0 as falta_senha_migracao;
\endif

\if :{?senha_aplicacao}
\else
  \echo 'ERRO: informe a senha do papel nobreza_aplicacao com -v senha_aplicacao=...'
  select 1 / 0 as falta_senha_aplicacao;
\endif

-- Papéis sem nenhum atributo de administração.
create role nobreza_migracao
  login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  password :'senha_migracao';

create role nobreza_aplicacao
  login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  password :'senha_aplicacao';

-- O dono dos bancos é o papel de migração: ele cria os esquemas e os objetos.
create database nobreza_app
  owner nobreza_migracao
  encoding 'UTF8'
  template template0;

create database nobreza_app_teste
  owner nobreza_migracao
  encoding 'UTF8'
  template template0;

-- Ninguém além dos dois papéis conecta. TEMP fica com a aplicação porque
-- consultas grandes podem precisar de tabelas temporárias implícitas.
revoke all on database nobreza_app from public;
revoke all on database nobreza_app_teste from public;
grant connect, temporary on database nobreza_app to nobreza_aplicacao;
grant connect, temporary on database nobreza_app_teste to nobreza_aplicacao;

-- O esquema public não é usado pela aplicação. Nos dois bancos novos, tira o
-- uso de public e deixa o fuso de apresentação padrão.
\connect nobreza_app
revoke all on schema public from public;
alter database nobreza_app set timezone to 'America/Sao_Paulo';

\connect nobreza_app_teste
revoke all on schema public from public;
alter database nobreza_app_teste set timezone to 'America/Sao_Paulo';

\echo 'Bootstrap concluído: papéis nobreza_migracao e nobreza_aplicacao; bancos nobreza_app e nobreza_app_teste.'
