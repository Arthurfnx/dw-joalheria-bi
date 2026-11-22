-- T02 — produto, saldo, tipos de movimentação, movimentação, venda e compra
-- (especificação, seções 4.2, 4.3 e 6.4). Venda e compra só a estrutura:
-- as funções delas pertencem às tarefas seguintes.

-- RN-21A: o tamanho só existe em categorias que o usam (Anel).
alter table app.categoria add column usa_tamanho boolean not null default false;

create table app.produto (
  id              bigint generated always as identity primary key,
  codigo          text not null unique check (codigo <> '' and codigo = upper(btrim(codigo))),
  descricao       text not null check (btrim(descricao) <> ''),
  material_id     bigint not null references app.material,
  categoria_id    bigint not null references app.categoria,
  subcategoria_id bigint,
  modo_controle   text not null check (modo_controle in ('UNITARIO', 'QUANTIDADE')),
  peso_gramas     numeric(10,3) check (peso_gramas > 0),
  tamanho         text check (btrim(tamanho) <> ''),
  pedras          text,
  preco_venda     numeric(14,2) check (preco_venda >= 0),
  estoque_minimo  integer check (estoque_minimo >= 0),
  observacao      text,
  indice_preco    numeric(14,4) check (indice_preco > 0),
  valor_aquisicao numeric(14,2) check (valor_aquisicao >= 0),
  data_aquisicao  date,
  local_estoque   text check (local_estoque in ('Estoque', 'Armário', 'Maleta 1', 'Maleta 2', 'Consignado')),
  consignado_com  text check (btrim(consignado_com) <> ''),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  foreign key (subcategoria_id, categoria_id) references app.subcategoria (id, categoria_id),
  check ((local_estoque = 'Consignado') = (consignado_com is not null))
);
create index produto_categoria_ix on app.produto (categoria_id);
create index produto_material_ix on app.produto (material_id);

create table app.saldo_estoque (
  produto_id    bigint primary key references app.produto,
  quantidade    integer not null default 0 check (quantidade >= 0),
  atualizado_em timestamptz not null default now()
);

create table app.tipo_movimentacao (
  codigo         text primary key,
  descricao      text not null,
  sinal          smallint not null check (sinal in (-1, 1)),
  eh_venda       boolean not null default false,
  exige_motivo   boolean not null default false,
  origem_exigida text not null check (origem_exigida in ('NENHUMA', 'VENDA_ITEM', 'COMPRA_ITEM')),
  uso_manual     boolean not null default false
);

insert into app.tipo_movimentacao (codigo, descricao, sinal, eh_venda, exige_motivo, origem_exigida, uso_manual) values
  ('IMPLANTACAO',     'Implantação de saldo',     1, false, false, 'NENHUMA',     true),
  ('ENTRADA_COMPRA',  'Entrada por compra',       1, false, false, 'COMPRA_ITEM', false),
  ('ESTORNO_COMPRA',  'Estorno de compra',       -1, false, true,  'COMPRA_ITEM', false),
  ('SAIDA_VENDA',     'Saída por venda',         -1, true,  false, 'VENDA_ITEM',  false),
  ('ESTORNO_VENDA',   'Estorno de venda',         1, false, true,  'VENDA_ITEM',  false),
  ('SAIDA_PRESENTE',  'Saída para presente',     -1, false, true,  'NENHUMA',     true),
  ('SAIDA_PERDA',     'Saída por perda',         -1, false, true,  'NENHUMA',     true),
  ('SAIDA_ROUBO',     'Saída por roubo',         -1, false, true,  'NENHUMA',     true),
  ('AJUSTE_POSITIVO', 'Ajuste positivo',          1, false, true,  'NENHUMA',     true),
  ('AJUSTE_NEGATIVO', 'Ajuste negativo',         -1, false, true,  'NENHUMA',     true);

create sequence app.venda_numero_seq;

create table app.venda (
  id                  bigint generated always as identity primary key,
  numero              bigint not null unique default nextval('app.venda_numero_seq'),
  chave_idempotencia  uuid not null unique,
  data_venda          date not null,
  situacao            text not null default 'CONFIRMADA' check (situacao in ('CONFIRMADA', 'CANCELADA')),
  vendedor_id         bigint not null references app.usuario,
  valor_total         numeric(14,2) not null check (valor_total >= 0),
  observacao          text,
  registrada_em       timestamptz not null default now(),
  cancelada_em        timestamptz,
  cancelada_por       bigint references app.usuario,
  motivo_cancelamento text,
  check (data_venda <= (registrada_em at time zone 'America/Sao_Paulo')::date),
  check ((situacao = 'CANCELADA')
         = (cancelada_em is not null and cancelada_por is not null
            and btrim(coalesce(motivo_cancelamento, '')) <> ''))
);

create table app.venda_item (
  id              bigint generated always as identity primary key,
  venda_id        bigint not null references app.venda,
  produto_id      bigint not null references app.produto,
  quantidade      integer not null check (quantidade > 0),
  preco_tabela    numeric(14,2) check (preco_tabela >= 0),
  preco_praticado numeric(14,2) not null check (preco_praticado >= 0),
  valor_item      numeric(14,2) generated always as (quantidade * preco_praticado) stored,
  unique (venda_id, produto_id)
);

create table app.compra (
  id                  bigint generated always as identity primary key,
  data_compra         date not null,
  situacao            text not null default 'RASCUNHO' check (situacao in ('RASCUNHO', 'CONFIRMADA', 'CANCELADA')),
  observacao          text,
  criada_por          bigint not null references app.usuario,
  criada_em           timestamptz not null default now(),
  confirmada_por      bigint references app.usuario,
  confirmada_em       timestamptz,
  cancelada_por       bigint references app.usuario,
  cancelada_em        timestamptz,
  motivo_cancelamento text
);

create table app.compra_item (
  id             bigint generated always as identity primary key,
  compra_id      bigint not null references app.compra,
  produto_id     bigint not null references app.produto,
  quantidade     integer not null check (quantidade > 0),
  custo_unitario numeric(14,2) not null check (custo_unitario >= 0),
  unique (compra_id, produto_id)
);

create table app.movimentacao_estoque (
  id              bigint generated always as identity primary key,
  produto_id      bigint not null references app.produto,
  tipo_codigo     text not null references app.tipo_movimentacao,
  quantidade      integer not null check (quantidade > 0),
  saldo_apos      integer not null check (saldo_apos >= 0),
  custo_unitario  numeric(14,2) check (custo_unitario >= 0),
  motivo          text,
  venda_item_id   bigint references app.venda_item,
  compra_item_id  bigint references app.compra_item,
  estorna_id      bigint unique references app.movimentacao_estoque,
  data_ocorrencia date not null,
  usuario_id      bigint not null references app.usuario,
  registrada_em   timestamptz not null default now(),
  check (venda_item_id is null or compra_item_id is null),
  check (data_ocorrencia <= (registrada_em at time zone 'America/Sao_Paulo')::date)
);
create index movimentacao_produto_ix on app.movimentacao_estoque (produto_id, id);

-- ---------------------------------------------------------------------------
-- Imutabilidade (I6). Valem até para o dono das tabelas.
-- ---------------------------------------------------------------------------

create function app.recusar_alteracao() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro imutável: % em % não é permitido.', tg_op, tg_table_name
    using errcode = 'NJ005';
end;
$$;

create trigger movimentacao_imutavel before update or delete on app.movimentacao_estoque
  for each row execute function app.recusar_alteracao();
create trigger venda_item_imutavel before update or delete on app.venda_item
  for each row execute function app.recusar_alteracao();
create trigger venda_sem_exclusao before delete on app.venda
  for each row execute function app.recusar_alteracao();
create trigger compra_sem_exclusao before delete on app.compra
  for each row execute function app.recusar_alteracao();

-- Item de compra só muda enquanto a compra está em rascunho.
create function app.proteger_compra_item() returns trigger
language plpgsql as $$
declare
  v_situacao text;
begin
  select situacao into v_situacao from app.compra
   where id = case when tg_op = 'INSERT' then new.compra_id else old.compra_id end;
  if v_situacao is distinct from 'RASCUNHO' then
    raise exception 'O item só pode ser alterado enquanto a compra está em rascunho.'
      using errcode = 'NJ005';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger compra_item_so_rascunho before insert or update or delete on app.compra_item
  for each row execute function app.proteger_compra_item();

-- ---------------------------------------------------------------------------
-- Regras do produto garantidas pelo banco
-- ---------------------------------------------------------------------------

create function app.validar_produto() returns trigger
language plpgsql as $$
declare
  v_usa_tamanho boolean;
  v_tem_movimentacao boolean;
  v_saldo integer;
begin
  -- RN-21A: tamanho só em categoria que usa tamanho, mesmo por chamada direta.
  if new.tamanho is not null then
    select usa_tamanho into v_usa_tamanho from app.categoria where id = new.categoria_id;
    if not coalesce(v_usa_tamanho, false) then
      raise exception 'Tamanho só é aceito em categoria que usa tamanho.' using errcode = 'NJ006';
    end if;
  end if;

  -- RN-21: data de aquisição nunca futura.
  if new.data_aquisicao is not null
     and new.data_aquisicao > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data de aquisição não pode ser futura.' using errcode = 'NJ006';
  end if;

  if tg_op = 'UPDATE' then
    -- RN-20 e RN-22: código e modo de controle não mudam depois da primeira movimentação.
    if new.codigo <> old.codigo or new.modo_controle <> old.modo_controle then
      select exists (select 1 from app.movimentacao_estoque where produto_id = old.id)
        into v_tem_movimentacao;
      if v_tem_movimentacao then
        raise exception 'Código e modo de controle não mudam depois que o produto tem movimentação.'
          using errcode = 'NJ006';
      end if;
    end if;

    -- RN-24: só desativa com saldo zero.
    if old.ativo and not new.ativo then
      select coalesce(quantidade, 0) into v_saldo from app.saldo_estoque where produto_id = old.id;
      if coalesce(v_saldo, 0) <> 0 then
        raise exception 'O produto só pode ser desativado com saldo zero.' using errcode = 'NJ006';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger produto_validar before insert or update on app.produto
  for each row execute function app.validar_produto();

-- Desligar "usa tamanho" deixaria produtos com tamanho numa categoria que não o aceita.
create function app.validar_categoria_tamanho() returns trigger
language plpgsql as $$
begin
  if old.usa_tamanho and not new.usa_tamanho
     and exists (select 1 from app.produto where categoria_id = old.id and tamanho is not null) then
    raise exception 'Há produtos desta categoria com tamanho preenchido.' using errcode = 'NJ006';
  end if;
  return new;
end;
$$;

create trigger categoria_tamanho before update of usa_tamanho on app.categoria
  for each row execute function app.validar_categoria_tamanho();

-- RN-30 (I2): produtos cujo saldo difere da soma das movimentações. Vazia quando tudo confere.
create view app.divergencia_saldo as
select p.id as produto_id,
       coalesce(s.quantidade, 0) as saldo,
       coalesce(m.soma, 0) as soma_movimentacoes
  from app.produto p
  left join app.saldo_estoque s on s.produto_id = p.id
  left join (
    select me.produto_id, sum(me.quantidade * t.sinal)::integer as soma
      from app.movimentacao_estoque me
      join app.tipo_movimentacao t on t.codigo = me.tipo_codigo
     group by me.produto_id
  ) m on m.produto_id = p.id
 where coalesce(s.quantidade, 0) <> coalesce(m.soma, 0);
