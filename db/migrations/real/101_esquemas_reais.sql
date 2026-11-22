-- =============================================================================
-- 101_esquemas_reais.sql — esquemas do DW REAL (dados do banco operacional
-- nobreza_app). Separados dos esquemas *_demo da fase 1, que não são tocados.
--
--   staging  cópia das extrações do banco operacional (recarga completa)
--   dw       modelo dimensional (recarga completa a cada execução do ETL)
--   bi       views de consumo do Power BI
--   audit    execuções, etapas, rejeições e verificações (somente inserções)
--
-- Aplicado por scripts/run_migrations_real.ps1. Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS bi;
CREATE SCHEMA IF NOT EXISTS audit;

COMMENT ON SCHEMA staging IS 'DW real: extração do banco operacional nobreza_app (recarga completa a cada execução do ETL).';
COMMENT ON SCHEMA dw      IS 'DW real: modelo dimensional (estrela) derivado do banco operacional; recarga completa.';
COMMENT ON SCHEMA bi      IS 'DW real: views de consumo do Power BI. Nenhum nome de pessoa.';
COMMENT ON SCHEMA audit   IS 'DW real: auditoria das execuções do ETL e das migrations. Somente inserções.';
