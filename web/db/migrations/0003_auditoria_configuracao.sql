-- T01 — auditoria imutável e parâmetros de configuração (RN-80, RN-81, seção 4.5).

create table app.auditoria (
  id           bigint generated always as identity primary key,
  ocorrido_em  timestamptz not null default now(),
  usuario_id   bigint references app.usuario,
  acao         text not null,
  entidade     text not null,
  entidade_id  text,
  dados_antes  jsonb,
  dados_depois jsonb
);
create index auditoria_ocorrido_ix on app.auditoria (ocorrido_em desc);

-- A auditoria só recebe linhas novas. O gatilho vale até para o dono da
-- tabela, que não é barrado pelos privilégios (I6).
create function app.recusar_alteracao_auditoria() returns trigger
language plpgsql as $$
begin
  raise exception 'A auditoria não pode ser alterada nem apagada (%).', tg_op;
end;
$$;

create trigger auditoria_imutavel
  before update or delete on app.auditoria
  for each row execute function app.recusar_alteracao_auditoria();

create table app.configuracao (
  chave          text primary key,
  valor          text not null,
  descricao      text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por bigint references app.usuario
);

insert into app.configuracao (chave, valor, descricao) values
  ('dias_produto_parado', '180',
   'Dias sem venda confirmada para um produto com saldo ser considerado parado');
