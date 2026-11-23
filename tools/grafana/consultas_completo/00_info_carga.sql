-- Indicador: data de referência dos dados (cabeçalho do painel).
-- Fórmula: data e status da última carga do DW (bi.vw_info_ambiente).
-- Unidade: data. "Hoje" em todos os painéis = data de referência da carga
-- (dia do último retrato do estoque), não o relógio do navegador.
SELECT to_char(data_referencia, 'DD/MM/YYYY')             AS "Dados de",
       status_ultima_execucao                              AS "Última carga",
       to_char(ultima_carga_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "Carregado em (Brasília)"
  FROM bi.vw_info_ambiente;
