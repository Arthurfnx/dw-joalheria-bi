-- =============================================================================
-- bi_leitura_real.sql — leitura do Power BI no esquema bi (DW real).
--
-- Reaproveita o papel bi_leitura criado por db/seguranca/bi_leitura.sql (fase
-- 1); se ele não existir, é criado aqui sem senha (cadastre-a manualmente,
-- fora do repositório, com \password bi_leitura).
-- Concede somente USAGE em bi e SELECT nas views de bi. Nenhum acesso a
-- staging, dw ou audit: as views de bi não usam security_invoker e leem dw
-- com os privilégios do dono.
-- Aplicado por scripts/run_migrations_real.ps1. Idempotente.
-- =============================================================================
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_leitura') THEN
        CREATE ROLE bi_leitura LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO bi_leitura', current_database());
END;
$$;

GRANT USAGE ON SCHEMA bi TO bi_leitura;
GRANT SELECT ON ALL TABLES IN SCHEMA bi TO bi_leitura;   -- inclui views

-- Views novas criadas pelo mesmo dono em bi ficam legíveis por bi_leitura.
ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT SELECT ON TABLES TO bi_leitura;

COMMIT;
