-- =============================================================================
-- 01_funcoes_aleatorias.sql — sorteio DETERMINÍSTICO baseado em md5.
-- Não usa random(): o mesmo (semente, fluxo, n) produz sempre o mesmo valor,
-- independentemente da versão do PostgreSQL. Aritmética em numeric.
-- =============================================================================

-- Número em [0, 1) derivado de md5(semente|fluxo|n) (52 bits).
CREATE OR REPLACE FUNCTION config_demo.rand_det(p_semente bigint, p_fluxo text, p_n bigint DEFAULT 0)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT (('x' || substr(md5(p_semente::text || '|' || p_fluxo || '|' || p_n::text), 1, 13))::bit(52)::bigint)::numeric
           / 4503599627370496::numeric
$$;
COMMENT ON FUNCTION config_demo.rand_det(bigint, text, bigint) IS 'Uniforme determinística em [0,1) a partir de md5(semente|fluxo|n).';

-- Uniforme em [p_min, p_max).
CREATE OR REPLACE FUNCTION config_demo.rand_entre(p_semente bigint, p_fluxo text, p_n bigint, p_min numeric, p_max numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT p_min + (p_max - p_min) * config_demo.rand_det(p_semente, p_fluxo, p_n)
$$;

-- Inteiro uniforme em [p_min, p_max].
CREATE OR REPLACE FUNCTION config_demo.rand_int(p_semente bigint, p_fluxo text, p_n bigint, p_min integer, p_max integer)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT p_min + least(floor(config_demo.rand_det(p_semente, p_fluxo, p_n) * (p_max - p_min + 1))::integer,
                         p_max - p_min)
$$;

-- Contagem de Poisson(λ) por inversão da distribuição acumulada.
CREATE OR REPLACE FUNCTION config_demo.poisson_det(p_semente bigint, p_fluxo text, p_lambda numeric)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
    v_u numeric := config_demo.rand_det(p_semente, p_fluxo, 0);
    v_k integer := 0;
    v_p numeric;
    v_f numeric;
BEGIN
    IF p_lambda IS NULL OR p_lambda <= 0 THEN
        RETURN 0;
    END IF;
    v_p := exp(-p_lambda);
    v_f := v_p;
    WHILE v_u > v_f AND v_k < 500 LOOP
        v_k := v_k + 1;
        v_p := v_p * p_lambda / v_k;
        v_f := v_f + v_p;
    END LOOP;
    RETURN v_k;
END;
$$;
COMMENT ON FUNCTION config_demo.poisson_det(bigint, text, numeric) IS 'Contagem Poisson determinística (limite técnico de 500).';
