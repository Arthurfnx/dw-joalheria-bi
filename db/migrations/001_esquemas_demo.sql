-- =============================================================================
-- 001_esquemas_demo.sql
-- Fase 1 (AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS).
-- Cria somente as cinco schemas exclusivas da demonstração.
-- As schemas do ambiente real (fase 2) NÃO são criadas aqui.
-- Idempotente: pode ser reexecutada.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS config_demo;
CREATE SCHEMA IF NOT EXISTS staging_demo;
CREATE SCHEMA IF NOT EXISTS dw_demo;
CREATE SCHEMA IF NOT EXISTS bi_demo;
CREATE SCHEMA IF NOT EXISTS audit_demo;

COMMENT ON SCHEMA config_demo  IS 'DEMO (sintético): parâmetros da simulação, distribuições e funções do gerador determinístico.';
COMMENT ON SCHEMA staging_demo IS 'DEMO (sintético): registros gerados por execução, antes da validação.';
COMMENT ON SCHEMA dw_demo      IS 'DEMO (sintético): modelo dimensional (estrela) e parâmetro versionado do preço do ouro.';
COMMENT ON SCHEMA bi_demo      IS 'DEMO (sintético): views de consumo pelo Power BI.';
COMMENT ON SCHEMA audit_demo   IS 'DEMO (sintético): execuções, etapas, rejeições, validações e correções. Não compartilhada com o ambiente real.';
