-- T01 — privilégios do papel da aplicação (especificação, seção 4.1).
-- O papel nobreza_aplicacao não cria objetos nem apaga linhas: só lê e grava
-- o que cada tabela permite.

grant usage on schema app to nobreza_aplicacao;

-- SELECT em tudo, inclusive nas tabelas que as próximas migrations criarem.
grant select on all tables in schema app to nobreza_aplicacao;
alter default privileges for role nobreza_migracao in schema app
  grant select on tables to nobreza_aplicacao;

grant insert, update on app.usuario      to nobreza_aplicacao;
grant insert, update on app.sessao       to nobreza_aplicacao;
grant insert, update on app.material     to nobreza_aplicacao;
grant insert, update on app.categoria    to nobreza_aplicacao;
grant insert, update on app.subcategoria to nobreza_aplicacao;
grant insert, update on app.configuracao to nobreza_aplicacao;
grant insert         on app.auditoria    to nobreza_aplicacao;

-- A função do gatilho não é chamada diretamente por ninguém.
revoke execute on function app.recusar_alteracao_auditoria() from public;
