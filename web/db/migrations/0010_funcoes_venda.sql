-- T03 — confirmação e cancelamento de venda (especificação, seções 3.5 e 4.4).
-- Toda a escrita de estoque passa pela função interna app._movimentar (T02).

-- ---------------------------------------------------------------------------
-- RN-40 a RN-44, I4, I8, I9, I10. p_itens: [{ produto_id, quantidade, preco_praticado }].
-- Devolve o id da venda. Com uma chave já usada, devolve a venda existente.
-- ---------------------------------------------------------------------------
create function app.confirmar_venda(
  p_chave      uuid,
  p_usuario_id bigint,
  p_data_venda date,
  p_observacao text,
  p_itens      jsonb
) returns bigint
language plpgsql security definer
set search_path = app, pg_temp
as $$
declare
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_venda   bigint;
  v_item    record;
  v_item_id bigint;
  v_codigo  text;
begin
  perform app._exigir_perfil(p_usuario_id, array['ADMINISTRADOR', 'VENDEDOR']);
  if p_chave is null then
    raise exception 'A chave da venda é obrigatória.' using errcode = 'NJ006';
  end if;

  -- RN-43 (I9): confirmações com a mesma chave são serializadas; a segunda
  -- encontra a venda gravada pela primeira e a devolve, sem duplicar.
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 0));
  select id into v_venda from app.venda where chave_idempotencia = p_chave;
  if found then
    return v_venda;
  end if;

  if p_data_venda is null or p_data_venda > v_hoje then
    raise exception 'A data da venda é obrigatória e não pode ser futura.' using errcode = 'NJ006';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa de pelo menos um item.' using errcode = 'NJ006';
  end if;

  create temp table _itens on commit drop as
  select x.produto_id, x.quantidade, x.preco_praticado
    from jsonb_to_recordset(p_itens) as x(produto_id bigint, quantidade integer, preco_praticado numeric);

  if exists (select 1 from _itens
              where produto_id is null or quantidade is null or quantidade <= 0
                 or preco_praticado is null or preco_praticado < 0
                 or preco_praticado <> round(preco_praticado, 2)) then
    raise exception 'Item inválido: informe produto, quantidade maior que zero e preço praticado (zero ou mais, em centavos).'
      using errcode = 'NJ006';
  end if;
  if exists (select produto_id from _itens group by produto_id having count(*) > 1) then
    raise exception 'O mesmo produto aparece mais de uma vez na venda.' using errcode = 'NJ006';
  end if;

  -- O total é a soma dos itens, recalculada abaixo a partir de venda_item.valor_item (I8).
  insert into app.venda (chave_idempotencia, data_venda, vendedor_id, valor_total, observacao)
  values (p_chave, p_data_venda, p_usuario_id, 0, nullif(btrim(p_observacao), ''))
  returning id into v_venda;

  -- Ordem crescente de produto: as linhas de saldo são bloqueadas sempre na
  -- mesma ordem, e duas vendas concorrentes não se bloqueiam mutuamente.
  for v_item in select * from _itens order by produto_id loop
    select codigo into v_codigo from app.produto where id = v_item.produto_id;

    -- RN-41 e RN-69: preço de tabela = preço de venda do cadastro; sem ele, o preço sugerido.
    insert into app.venda_item (venda_id, produto_id, quantidade, preco_tabela, preco_praticado)
    select v_venda, p.id, v_item.quantidade,
           coalesce(p.preco_venda, app.preco_sugerido(p.id, v_hoje)),
           v_item.preco_praticado
      from app.produto p
     where p.id = v_item.produto_id
    returning id into v_item_id;
    if v_item_id is null then
      raise exception 'Produto % inexistente.', v_item.produto_id using errcode = 'NJ003';
    end if;

    begin
      perform app._movimentar(v_item.produto_id, 'SAIDA_VENDA', v_item.quantidade, p_data_venda,
                              null, null, p_usuario_id, v_item_id);
    exception
      -- RN-42: a mensagem identifica o produto; nada da venda fica gravado.
      when sqlstate 'NJ001' then
        raise exception 'Saldo insuficiente para o produto %.', v_codigo using errcode = 'NJ001';
      when sqlstate 'NJ003' then
        raise exception 'O produto % está inativo e não pode ser vendido.', v_codigo using errcode = 'NJ003';
    end;
    v_item_id := null;
  end loop;

  update app.venda
     set valor_total = (select sum(valor_item) from app.venda_item where venda_id = v_venda)
   where id = v_venda;
  return v_venda;
end;
$$;

-- ---------------------------------------------------------------------------
-- RN-45 e RN-46 (I5): cancelamento inteiro, só pelo administrador, com motivo.
-- Cada item recebe um ESTORNO_VENDA ligado à saída original.
-- ---------------------------------------------------------------------------
create function app.cancelar_venda(
  p_venda_id   bigint,
  p_usuario_id bigint,
  p_motivo     text
) returns void
language plpgsql security definer
set search_path = app, pg_temp
as $$
declare
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_situacao text;
  v_item     record;
begin
  perform app._exigir_perfil(p_usuario_id, array['ADMINISTRADOR']);
  if btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'NJ006';
  end if;

  select situacao into v_situacao from app.venda where id = p_venda_id for update;
  if not found then
    raise exception 'Venda inexistente.' using errcode = 'NJ006';
  end if;
  if v_situacao <> 'CONFIRMADA' then
    raise exception 'A venda já está cancelada.' using errcode = 'NJ005';
  end if;

  for v_item in
    select vi.id, vi.produto_id, vi.quantidade, p.codigo, m.id as saida_id
      from app.venda_item vi
      join app.produto p on p.id = vi.produto_id
      join app.movimentacao_estoque m on m.venda_item_id = vi.id and m.tipo_codigo = 'SAIDA_VENDA'
     where vi.venda_id = p_venda_id
     order by vi.produto_id
  loop
    begin
      perform app._movimentar(v_item.produto_id, 'ESTORNO_VENDA', v_item.quantidade, v_hoje,
                              p_motivo, null, p_usuario_id, v_item.id, null, v_item.saida_id);
    exception
      when sqlstate 'NJ002' then
        raise exception 'Não é possível cancelar: a peça única % já voltou ao estoque por outro caminho.', v_item.codigo
          using errcode = 'NJ002';
      when sqlstate 'NJ003' then
        raise exception 'Não é possível cancelar: o produto % está inativo. Reative-o antes.', v_item.codigo
          using errcode = 'NJ003';
    end;
  end loop;

  update app.venda
     set situacao = 'CANCELADA', cancelada_em = now(), cancelada_por = p_usuario_id,
         motivo_cancelamento = btrim(p_motivo)
   where id = p_venda_id;
end;
$$;

revoke execute on function app.confirmar_venda(uuid, bigint, date, text, jsonb) from public;
revoke execute on function app.cancelar_venda(bigint, bigint, text) from public;
grant execute on function app.confirmar_venda(uuid, bigint, date, text, jsonb) to nobreza_aplicacao;
grant execute on function app.cancelar_venda(bigint, bigint, text) to nobreza_aplicacao;
