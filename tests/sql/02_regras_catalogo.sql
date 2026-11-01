-- =============================================================================
-- 02_regras_catalogo.sql — regras por material e tipo de peça.
-- Inclui testes NEGATIVOS (inserções inválidas devem falhar). ROLLBACK ao final.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_n integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dw_demo.dim_produto) THEN
        RAISE EXCEPTION 'FALHA [CAT-00]: dim_produto vazia — execute scripts/run_demo_etl.ps1 antes dos testes';
    END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE material = 'Ouro' AND (peso_g IS NULL OR peso_g <= 0);
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [CAT-01]: % Ouro sem peso', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE material = 'Folheado' AND peso_g IS NOT NULL;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [CAT-02]: % Folheado com peso', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE tipo_peca = 'Anel' AND tamanho IS NULL;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [CAT-03a]: % Anel sem tamanho', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto WHERE material = 'Ouro' AND tipo_peca <> 'Anel' AND tamanho IS NOT NULL;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [CAT-03b]: % Ouro não-anel com tamanho', v_n; END IF;

    SELECT count(*) INTO v_n FROM dw_demo.dim_produto
     WHERE indice_precificacao <= 0 OR codigo_produto !~ '^DEMO-(OURO|PRATA|FOLHADO)-[0-9]{4}$';
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [CAT-04]: % produto(s) com índice/código inválido', v_n; END IF;

    -- Os três materiais existem e material ≠ tipo de peça.
    SELECT count(DISTINCT material) INTO v_n FROM dw_demo.dim_produto;
    IF v_n <> 3 THEN RAISE EXCEPTION 'FALHA [CAT-05]: esperados 3 materiais, obtidos %', v_n; END IF;
    IF EXISTS (SELECT 1 FROM dw_demo.dim_produto WHERE tipo_peca IN ('Ouro', 'Prata', 'Folheado')) THEN
        RAISE EXCEPTION 'FALHA [CAT-06]: material usado como tipo de peça';
    END IF;

    -- Negativo: Ouro sem peso deve ser rejeitado pela restrição.
    BEGIN
        INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
        VALUES ('DEMO-OURO-9999', 'Teste negativo', 'Ouro', 'Brinco', NULL, NULL, 1.0);
        RAISE EXCEPTION 'FALHA [CAT-N1]: Ouro sem peso foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Negativo: Folheado com peso deve ser rejeitado.
    BEGIN
        INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
        VALUES ('DEMO-FOLHADO-9999', 'Teste negativo', 'Folheado', 'Brinco', NULL, 2.0, 0.2);
        RAISE EXCEPTION 'FALHA [CAT-N2]: Folheado com peso foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Negativo: Anel sem tamanho deve ser rejeitado.
    BEGIN
        INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
        VALUES ('DEMO-PRATA-9999', 'Teste negativo', 'Prata', 'Anel', NULL, NULL, 0.3);
        RAISE EXCEPTION 'FALHA [CAT-N3]: Anel sem tamanho foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Positivo: Aliança SEM tamanho é aceita (não há obrigatoriedade).
    INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
    VALUES ('DEMO-PRATA-9998', 'Teste positivo', 'Prata', 'Aliança', NULL, NULL, 0.3);

    -- Positivo: Tornozeleira de Ouro e Aliança de Folheado são aceitas (sem restrição tipo × material).
    INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
    VALUES ('DEMO-OURO-9998', 'Teste positivo', 'Ouro', 'Tornozeleira', NULL, 2.5, 2.8),
           ('DEMO-FOLHADO-9998', 'Teste positivo', 'Folheado', 'Aliança', NULL, NULL, 0.1);

    -- Negativo: código fora do padrão.
    BEGIN
        INSERT INTO dw_demo.dim_produto (codigo_produto, descricao, material, tipo_peca, tamanho, peso_g, indice_precificacao)
        VALUES ('XYZ-TESTE-0001', 'Teste negativo', 'Prata', 'Brinco', NULL, NULL, 0.3);
        RAISE EXCEPTION 'FALHA [CAT-N4]: código fora do padrão DEMO foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE NOTICE 'OK 02_regras_catalogo';
END;
$$;

ROLLBACK;
