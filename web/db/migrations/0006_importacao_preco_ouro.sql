-- T02 — importação das planilhas, histórico de vendas da planilha, preço do
-- ouro e preço sugerido (especificação, seções 3.7A, 6.3 e 6.4).

create table app.importacao_lote (
  id            bigint generated always as identity primary key,
  arquivo       text not null,
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  usuario_id    bigint not null references app.usuario,
  contagens     jsonb not null default '{}'
);

-- RN-103: só aba, linha, código e motivo; nunca descrição nem nome de pessoa.
create table app.importacao_ocorrencia (
  id       bigint generated always as identity primary key,
  lote_id  bigint not null references app.importacao_lote,
  aba      text not null,
  linha    integer not null,
  codigo   text,
  tipo     text not null check (tipo in ('REJEITADA', 'REVISAR')),
  motivo   text not null
);
create index importacao_ocorrencia_lote_ix on app.importacao_ocorrencia (lote_id, tipo);

-- RN-98. local_original pode conter nome de pessoa: nunca vai para o DW (seção 6A).
create table app.produto_origem (
  produto_id        bigint primary key references app.produto,
  lote_id           bigint not null references app.importacao_lote,
  aba               text not null,
  linha             integer not null,
  arquivo           text not null,
  local_original    text,
  tamanho_original  text,
  situacao_original text not null check (situacao_original in ('EM_ESTOQUE', 'CONSIGNADA', 'VENDIDA', 'PERDIDA', 'REVISAR'))
);

-- RN-99: vendas antigas da planilha. Não são vendas da aplicação: sem número,
-- sem cliente, fora de ticket médio e associação.
create table app.venda_historica (
  id            bigint generated always as identity primary key,
  produto_id    bigint not null references app.produto,
  lote_id       bigint not null references app.importacao_lote,
  data_venda    date not null,
  valor_venda   numeric(14,2) check (valor_venda >= 0),
  valor_compra  numeric(14,2) check (valor_compra >= 0),
  simbolico     boolean not null default false
);
create index venda_historica_produto_ix on app.venda_historica (produto_id);

-- RN-66: cada registro é imutável; corrige-se com um registro novo.
create table app.preco_ouro (
  id               bigint generated always as identity primary key,
  valor_grama      numeric(14,2) not null check (valor_grama > 0),
  vigente_desde    date not null,
  registrado_em    timestamptz not null default now(),
  registrado_por   bigint not null references app.usuario
);
create index preco_ouro_vigencia_ix on app.preco_ouro (vigente_desde desc, id desc);

create trigger preco_ouro_imutavel before update or delete on app.preco_ouro
  for each row execute function app.recusar_alteracao();

insert into app.configuracao (chave, valor, descricao) values
  ('fator_preco_ouro', '1.6', 'Fator do preço sugerido: preço do ouro × fator × índice de preço');

-- RN-67: preço vigente numa data = registro com a maior vigência até ela.
-- Empate na mesma data: vale o registro mais recente, que é a correção.
create function app.preco_ouro_vigente(p_data date) returns numeric
language sql stable as $$
  select valor_grama from app.preco_ouro
   where vigente_desde <= p_data
   order by vigente_desde desc, id desc
   limit 1
$$;

-- RN-68: só para Ouro com índice e preço vigente; arredondado em centavos.
create function app.preco_sugerido(
  p_produto_id bigint,
  p_data date default (now() at time zone 'America/Sao_Paulo')::date
) returns numeric
language sql stable as $$
  select round(app.preco_ouro_vigente(p_data) * cfg.fator * p.indice_preco, 2)
    from app.produto p
    join app.material m on m.id = p.material_id
   cross join (select valor::numeric as fator from app.configuracao where chave = 'fator_preco_ouro') cfg
   where p.id = p_produto_id
     and lower(m.nome) = 'ouro'
     and p.indice_preco is not null
$$;
