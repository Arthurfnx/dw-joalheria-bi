-- =============================================================================
-- bi_leitura.sql — usuário exclusivo de LEITURA para o Power BI (ambiente demo).
--
-- Executar conectado ao banco dw_joalheria como o administrador (postgres),
-- que é também o proprietário que cria as views de bi_demo (run_migrations.ps1).
-- NÃO faz parte de run_migrations.ps1: aplicar somente com autorização.
--
-- Concede somente:
--   - CONNECT no banco atual;
--   - USAGE na schema bi_demo;
--   - SELECT nas views/tabelas existentes de bi_demo;
--   - privilégio padrão: SELECT em novas views/tabelas que postgres criar em bi_demo.
-- Não concede SUPERUSER, CREATE, INSERT, UPDATE, DELETE nem acesso a
-- staging_demo, dw_demo, config_demo ou audit_demo. As views de bi_demo não
-- usam security_invoker; por isso leem dw_demo com os privilégios do dono.
--
-- SENHA: este arquivo NÃO define senha. Cadastre-a manualmente, fora do
-- repositório (por exemplo, no psql interativo com \password bi_leitura).
-- Idempotente: pode ser reaplicado sem efeitos adicionais.
-- =============================================================================
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_leitura') THEN
        CREATE ROLE bi_leitura LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
END;
$$;

COMMENT ON ROLE bi_leitura IS 'Leitura do Power BI: somente SELECT em bi_demo (ambiente demonstrativo). Senha cadastrada manualmente.';

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO bi_leitura', current_database());
END;
$$;

GRANT USAGE ON SCHEMA bi_demo TO bi_leitura;
GRANT SELECT ON ALL TABLES IN SCHEMA bi_demo TO bi_leitura;   -- inclui views

-- Novas views/tabelas criadas por postgres em bi_demo ficam legíveis por bi_leitura.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bi_demo GRANT SELECT ON TABLES TO bi_leitura;

COMMIT;
