-- T02 — duas decisões do usuário de 2026-11-22 sobre a importação.
--
-- Aliança também usa tamanho (RN-21A e RN-93):
-- 1. A importação passa a criar a categoria Aliança com usa_tamanho = true, como Anel.
-- 2. No banco já importado, a categoria Aliança passa a usar tamanho e as alianças
--    recebem em `tamanho` o valor guardado em produto_origem.tamanho_original, com a
--    mesma normalização da leitura ("T16" e "T 16" viram "16"). Cada produto alterado
--    ganha um registro de auditoria. As ocorrências REVISAR do lote já executado ficam
--    como estão: registram o que a importação fez naquela data.
--
-- Vendido sem data de venda conta como vendido: continua VENDIDA, com saldo 0 e sem
-- venda_historica (a data não existe e não é inventada), mas deixa de gerar a
-- ocorrência REVISAR "Vendida sem data de venda". No lote já executado não houve
-- nenhum caso, então não há dado a corrigir.

update app.categoria set usa_tamanho = true where lower(nome) = 'aliança' and not usa_tamanho;

with alterados as (
  update app.produto p
     set tamanho = nullif(btrim(regexp_replace(o.tamanho_original, '^[Tt]\s*', '')), ''),
         atualizado_em = now()
    from app.produto_origem o, app.categoria c
   where o.produto_id = p.id
     and c.id = p.categoria_id
     and lower(c.nome) = 'aliança'
     and p.tamanho is null
     and o.tamanho_original is not null
  returning p.id, p.tamanho
)
insert into app.auditoria (usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
select null, 'ALTERAR', 'produto', id::text,
       jsonb_build_object('tamanho', null),
       jsonb_build_object('tamanho', tamanho, 'origem', 'MIGRACAO_0009_ALIANCA_COM_TAMANHO')
  from alterados;

create or replace function app.importar_lote(
  p_usuario_id bigint,
  p_arquivo    text,
  p_linhas     jsonb,
  p_categorias jsonb
) returns bigint
language plpgsql security definer
set search_path = app, pg_temp
as $$
declare
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lote      bigint;
  v_linha     record;
  v_produto   bigint;
  v_material  bigint;
  v_categoria bigint;
  v_usa_tam   boolean;
  v_contagens jsonb := '{}';
begin
  perform app._exigir_perfil(p_usuario_id, array['ADMINISTRADOR']);

  -- RN-101: só num banco sem produtos. O bloqueio impede duas importações simultâneas.
  lock table app.produto in share row exclusive mode;
  if exists (select 1 from app.produto) then
    raise exception 'Importação recusada: o banco já tem produtos. A importação é feita uma única vez.'
      using errcode = 'NJ005';
  end if;

  insert into app.importacao_lote (arquivo, usuario_id) values (p_arquivo, p_usuario_id)
    returning id into v_lote;

  create temp table _imp on commit drop as
  select x.*,
         upper(btrim(coalesce(x.codigo, ''))) as cod,
         nullif(btrim(coalesce(x.descricao, '')), '') as descr,
         upper(btrim(coalesce(x.local_planilha, ''))) as local_n,
         null::text as material,
         null::text as rejeicao,
         null::text as categoria,
         null::text as situacao,
         null::text as local_estoque,
         null::text as consignado_com,
         null::text as tamanho_final,
         null::date as data_aquisicao
    from jsonb_to_recordset(p_linhas) as x(
      fonte text, arquivo text, aba text, linha integer, codigo text, descricao text,
      chave_categoria text, valor_compra numeric, peso numeric, tamanho text,
      tamanho_original text, indice numeric, local_planilha text, data_compra date,
      data_compra_invalida boolean, valor_venda numeric, data_venda date,
      data_venda_invalida boolean);

  create temp table _ocorrencia (aba text, linha integer, codigo text, tipo text, motivo text) on commit drop;

  -- RN-91 e RN-92: rejeições, na ordem de prioridade do motivo.
  update _imp set rejeicao = 'Código vazio' where cod = '';
  update _imp set rejeicao = 'Linha de serviço' where rejeicao is null and cod ~* '^SERVI[CÇ]O$';
  update _imp set material = case
      when fonte = 'CLS' then 'Ouro'
      when cod ~ '^R07[0-9]+$' then 'Prata'
      when cod ~ '^[0-9]+-[0-9]+$' then 'Folheado'
    end
   where rejeicao is null;
  update _imp set rejeicao = 'Padrão de código desconhecido' where rejeicao is null and material is null;
  update _imp set rejeicao = 'Descrição vazia' where rejeicao is null and descr is null;
  -- Código do CLS igual ao de FOLHEADOS ou RAMON: as duas ocorrências saem.
  update _imp i set rejeicao = 'Código coincide entre o CLS e outra fonte'
   where rejeicao is null
     and exists (select 1 from _imp o
                  where o.cod = i.cod and o.cod <> ''
                    and (o.fonte = 'CLS') <> (i.fonte = 'CLS'));
  -- Código repetido dentro da mesma fonte: todas as ocorrências saem.
  update _imp i set rejeicao = 'Código repetido'
   where rejeicao is null
     and (select count(*) from _imp o where o.fonte = i.fonte and o.cod = i.cod) > 1;
  -- RAMON só traz as peças que não estão em FOLHEADOS.
  update _imp i set rejeicao = 'Peça já existe em FOLHEADOS'
   where rejeicao is null and fonte = 'RAMON'
     and exists (select 1 from _imp o where o.fonte = 'FOLHEADOS' and o.cod = i.cod);

  insert into _ocorrencia
  select aba, linha, nullif(cod, ''), 'REJEITADA', rejeicao from _imp where rejeicao is not null;

  -- RN-93: categoria pela tabela de grafias; fora dela, "A classificar".
  update _imp set categoria = coalesce(p_categorias ->> chave_categoria, 'A classificar')
   where rejeicao is null;
  insert into _ocorrencia
  select aba, linha, cod, 'REVISAR', 'Categoria a classificar'
    from _imp where rejeicao is null and categoria = 'A classificar';

  -- RN-95 e RN-96: situação pela data de venda e pelo local.
  update _imp set
    situacao = case
      when fonte = 'CLS' then 'EM_ESTOQUE'
      when data_venda is not null then 'VENDIDA'
      when coalesce(data_venda_invalida, false) then 'REVISAR'
      when local_n in ('ESTOQUE', 'NOVO', 'ARMARIO', 'ARMÁRIO', 'MALETA 1', '2 MALETA', 'MALETA 2') then 'EM_ESTOQUE'
      when local_n = 'VENDIDO' then 'VENDIDA'
      when local_n = 'SUMIU' then 'PERDIDA'
      when local_n = '' then 'REVISAR'
      else 'CONSIGNADA'
    end
   where rejeicao is null;
  update _imp set
    local_estoque = case
      when fonte = 'CLS' then 'Estoque'
      when situacao = 'CONSIGNADA' then 'Consignado'
      when situacao <> 'EM_ESTOQUE' then null
      when local_n in ('ESTOQUE', 'NOVO') then 'Estoque'
      when local_n in ('ARMARIO', 'ARMÁRIO') then 'Armário'
      when local_n = 'MALETA 1' then 'Maleta 1'
      else 'Maleta 2'
    end,
    consignado_com = case when situacao = 'CONSIGNADA' then btrim(local_planilha) end
   where rejeicao is null;

  insert into _ocorrencia
  select aba, linha, cod, 'REVISAR', motivo from (
    select aba, linha, cod, 'Venda registrada com local diferente de VENDIDO' as motivo
      from _imp where rejeicao is null and fonte <> 'CLS' and data_venda is not null and local_n <> 'VENDIDO'
    union all
    select aba, linha, cod, 'Data de venda inválida'
      from _imp where rejeicao is null and fonte <> 'CLS' and data_venda is null and coalesce(data_venda_invalida, false)
    union all
    select aba, linha, cod, 'Local do estoque vazio'
      from _imp where rejeicao is null and fonte <> 'CLS' and data_venda is null
                  and not coalesce(data_venda_invalida, false) and local_n = ''
    union all
    select aba, linha, cod, 'Data de compra inválida ou futura'
      from _imp where rejeicao is null
                  and (coalesce(data_compra_invalida, false) or data_compra > v_hoje)
  ) r;
  update _imp set data_aquisicao = case when data_compra <= v_hoje then data_compra end
   where rejeicao is null;

  -- RN-12: materiais e categorias são criados pela importação quando faltam.
  insert into app.material (nome)
  select distinct material from _imp i
   where rejeicao is null
     and not exists (select 1 from app.material m where lower(m.nome) = lower(i.material));
  insert into app.categoria (nome, usa_tamanho)
  select distinct categoria, lower(categoria) in ('anel', 'aliança') from _imp i
   where rejeicao is null
     and not exists (select 1 from app.categoria c where lower(c.nome) = lower(i.categoria));

  -- RN-94A: tamanho só em categoria que usa tamanho; o resto fica na origem, para revisão.
  update _imp i set tamanho_final = i.tamanho
    from app.categoria c
   where i.rejeicao is null and lower(c.nome) = lower(i.categoria) and c.usa_tamanho;
  insert into _ocorrencia
  select aba, linha, cod, 'REVISAR', 'Tamanho em categoria que não usa tamanho'
    from _imp where rejeicao is null and tamanho_final is null and tamanho_original is not null;

  for v_linha in select * from _imp where rejeicao is null order by fonte, linha loop
    select id into v_material from app.material where lower(nome) = lower(v_linha.material);
    select id, usa_tamanho into v_categoria, v_usa_tam from app.categoria where lower(nome) = lower(v_linha.categoria);

    insert into app.produto
      (codigo, descricao, material_id, categoria_id, modo_controle, peso_gramas, tamanho,
       indice_preco, valor_aquisicao, data_aquisicao, local_estoque, consignado_com)
    values
      (v_linha.cod, v_linha.descr, v_material, v_categoria, 'UNITARIO',
       case when v_linha.peso > 0 then round(v_linha.peso, 3) end,
       v_linha.tamanho_final,
       case when v_linha.indice > 0 then round(v_linha.indice, 4) end,
       case when v_linha.fonte <> 'CLS' and v_linha.valor_compra >= 0 then round(v_linha.valor_compra, 2) end,
       case when v_linha.fonte <> 'CLS' then v_linha.data_aquisicao end,
       v_linha.local_estoque, v_linha.consignado_com)
    returning id into v_produto;

    insert into app.produto_origem
      (produto_id, lote_id, aba, linha, arquivo, local_original, tamanho_original, situacao_original)
    values
      (v_produto, v_lote, v_linha.aba, v_linha.linha, v_linha.arquivo,
       nullif(btrim(coalesce(v_linha.local_planilha, '')), ''), v_linha.tamanho_original, v_linha.situacao);

    -- RN-97: saldo 1 para peças em estoque e consignadas, pela função de escrita.
    if v_linha.situacao in ('EM_ESTOQUE', 'CONSIGNADA') then
      perform app._movimentar(v_produto, 'IMPLANTACAO', 1, v_hoje, null,
        case when v_linha.fonte <> 'CLS' and v_linha.valor_compra >= 0 then round(v_linha.valor_compra, 2) end,
        p_usuario_id);
    end if;

    -- RN-99: venda da planilha, sem cliente; R$ 0,01 é simbólico.
    if v_linha.data_venda is not null then
      insert into app.venda_historica (produto_id, lote_id, data_venda, valor_venda, valor_compra, simbolico)
      values (v_produto, v_lote, v_linha.data_venda,
              case when v_linha.valor_venda >= 0 then round(v_linha.valor_venda, 2) end,
              case when v_linha.valor_compra >= 0 then round(v_linha.valor_compra, 2) end,
              coalesce(round(v_linha.valor_venda, 2) = 0.01, false));
    end if;
  end loop;

  insert into app.importacao_ocorrencia (lote_id, aba, linha, codigo, tipo, motivo)
  select v_lote, aba, linha, codigo, tipo, motivo from _ocorrencia order by aba, linha, tipo;

  -- RN-103 e RN-105: contagens por aba.
  select coalesce(jsonb_object_agg(aba, dados), '{}') into v_contagens from (
    select i.aba, jsonb_build_object(
      'lidas',             count(*),
      'importadas',        count(*) filter (where rejeicao is null),
      'rejeitadas',        count(*) filter (where rejeicao is not null),
      'em_estoque',        count(*) filter (where situacao = 'EM_ESTOQUE'),
      'consignadas',       count(*) filter (where situacao = 'CONSIGNADA'),
      'vendidas',          count(*) filter (where situacao = 'VENDIDA'),
      'perdidas',          count(*) filter (where situacao = 'PERDIDA'),
      'a_revisar',         count(*) filter (where situacao = 'REVISAR'),
      'vendas_historicas', count(*) filter (where rejeicao is null and data_venda is not null),
      'ocorrencias_revisar', (select count(*) from _ocorrencia o where o.aba = i.aba and o.tipo = 'REVISAR')
    ) as dados
      from _imp i
     group by i.aba
  ) c;

  update app.importacao_lote set concluido_em = now(), contagens = v_contagens where id = v_lote;
  return v_lote;
end;
$$;

revoke execute on function app.importar_lote(bigint, text, jsonb, jsonb) from public;
grant execute on function app.importar_lote(bigint, text, jsonb, jsonb) to nobreza_aplicacao;
