-- =============================================================================
-- 08_auditoria.sql — última execução bem-sucedida, todas as verificações
-- aprovadas, nenhuma rejeição e contagens por etapa registradas.
-- =============================================================================
BEGIN;

DO $$
DECLARE
    v_exec   bigint;
    v_status text;
    v_n      bigint;
BEGIN
    SELECT id_execucao, status INTO v_exec, v_status
      FROM audit_demo.execucao ORDER BY id_execucao DESC LIMIT 1;
    IF v_exec IS NULL THEN RAISE EXCEPTION 'FALHA [AUD-01]: nenhuma execução registrada'; END IF;
    IF v_status <> 'SUCESSO' THEN
        RAISE EXCEPTION 'FALHA [AUD-01]: última execução (%) com status %', v_exec, v_status;
    END IF;

    SELECT count(*) INTO v_n FROM audit_demo.resultado_validacao WHERE id_execucao = v_exec AND NOT aprovado;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [AUD-02]: % verificação(ões) reprovada(s) na execução %', v_n, v_exec; END IF;

    SELECT count(*) INTO v_n FROM audit_demo.resultado_validacao WHERE id_execucao = v_exec;
    IF v_n < 24 THEN RAISE EXCEPTION 'FALHA [AUD-03]: esperadas 24 verificações, obtidas %', v_n; END IF;

    SELECT count(*) INTO v_n FROM audit_demo.rejeicao WHERE id_execucao = v_exec;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA [AUD-04]: % rejeição(ões) na execução %', v_n, v_exec; END IF;

    SELECT count(DISTINCT etapa) INTO v_n FROM audit_demo.etapa WHERE id_execucao = v_exec;
    IF v_n < 9 THEN RAISE EXCEPTION 'FALHA [AUD-05]: esperadas ao menos 9 etapas registradas, obtidas %', v_n; END IF;

    RAISE NOTICE 'OK 08_auditoria (execução %)', v_exec;
END;
$$;

ROLLBACK;
