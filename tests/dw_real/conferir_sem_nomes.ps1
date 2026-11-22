# =============================================================================
# conferir_sem_nomes.ps1 — critério 5 da T04: nenhum nome de pessoa no DW.
# SOMENTE LEITURA nos dois bancos. NUNCA imprime nem grava nomes.
#
# 1. No banco operacional, com o papel de migração (único que lê a coluna),
#    obtém o md5 de cada valor distinto de app.produto.consignado_com,
#    normalizado (minúsculas, espaços simples, sem espaços nas pontas).
#    Só os hashes saem do banco; os nomes nunca chegam a este script.
# 2. No DW, calcula o md5 de cada valor de texto das tabelas de dw e staging e
#    das views de bi, e de cada sequência de 1 a 6 palavras dentro desses
#    textos (um nome pode aparecer dentro de uma descrição).
# 3. Conta as coincidências. Esperado: 0.
#
# Variáveis do .env da raiz: APP_MIGRACAO_PGUSER (padrão nobreza_migracao) e
# APP_MIGRACAO_PGPASSWORD; host, porta e banco como em run_etl_app.ps1.
# Uso: powershell -ExecutionPolicy Bypass -File tests\dw_real\conferir_sem_nomes.ps1
# =============================================================================
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv

function Get-Variavel([string]$Nome, [string]$Padrao) {
    $v = [Environment]::GetEnvironmentVariable($Nome, 'Process')
    if ([string]::IsNullOrWhiteSpace($v)) { return $Padrao }
    return $v
}

$origem = @{
    PGHOST     = Get-Variavel 'APP_PGHOST' $env:PGHOST
    PGPORT     = Get-Variavel 'APP_PGPORT' $env:PGPORT
    PGDATABASE = Get-Variavel 'APP_PGDATABASE' 'nobreza_app'
    PGUSER     = Get-Variavel 'APP_MIGRACAO_PGUSER' 'nobreza_migracao'
    PGPASSWORD = Get-Variavel 'APP_MIGRACAO_PGPASSWORD' ''
}

$normalizar = "md5(lower(regexp_replace(btrim(%s), '\s+', ' ', 'g')))"

# 1. Hashes dos nomes (nunca os nomes).
$salvas = @{}
foreach ($k in $origem.Keys) { $salvas[$k] = [Environment]::GetEnvironmentVariable($k, 'Process') }
try {
    foreach ($k in $origem.Keys) { [Environment]::SetEnvironmentVariable($k, $origem[$k], 'Process') }
    $sqlOrigem = "BEGIN TRANSACTION READ ONLY; SELECT DISTINCT " + $normalizar.Replace('%s', 'consignado_com') +
                 " FROM app.produto WHERE consignado_com IS NOT NULL AND btrim(consignado_com) <> ''; ROLLBACK;"
    $hashes = @(Invoke-Psql -Tuplas -Comando $sqlOrigem | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[0-9a-f]{32}$' })
} finally {
    foreach ($k in $salvas.Keys) { [Environment]::SetEnvironmentVariable($k, $salvas[$k], 'Process') }
}
Write-Host "Nomes distintos em consignado_com (só a contagem): $($hashes.Count)"
if ($hashes.Count -eq 0) {
    Write-Warning 'Nenhum nome encontrado no banco operacional: a busca não tem o que procurar.'
}

# 2-3. Busca no DW.
$lista = if ($hashes.Count -gt 0) { ($hashes | ForEach-Object { "('$_')" }) -join ',' } else { "('')" }
$sqlDw = @"
BEGIN;  -- só tabelas temporárias; termina em ROLLBACK
CREATE TEMP TABLE alvo (h text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO alvo VALUES $lista ON CONFLICT DO NOTHING;
CREATE TEMP TABLE valores (relacao text, v text) ON COMMIT DROP;
DO `$`$
DECLARE r record;
BEGIN
    FOR r IN SELECT c.table_schema, c.table_name, c.column_name
               FROM information_schema.columns c
              WHERE c.table_schema IN ('staging', 'dw', 'bi')
                AND c.data_type IN ('text', 'character varying', 'character')
    LOOP
        EXECUTE format('INSERT INTO valores SELECT %L, %I::text FROM %I.%I WHERE %I IS NOT NULL',
                       r.table_schema || '.' || r.table_name || '.' || r.column_name,
                       r.column_name, r.table_schema, r.table_name, r.column_name);
    END LOOP;
END;
`$`$;
WITH textos AS (
    SELECT relacao, lower(regexp_replace(btrim(v), '\s+', ' ', 'g')) AS t FROM valores
),
palavras AS (
    SELECT relacao, t, string_to_array(t, ' ') AS p FROM textos
),
trechos AS (
    SELECT relacao, md5(array_to_string(p[i:j], ' ')) AS h
      FROM palavras
     CROSS JOIN LATERAL generate_series(1, cardinality(p)) i
     CROSS JOIN LATERAL generate_series(i, least(cardinality(p), i + 5)) j
    UNION ALL
    SELECT relacao, md5(t) FROM textos
)
SELECT 'colunas de texto verificadas', count(DISTINCT relacao)::text FROM valores
UNION ALL SELECT 'valores de texto verificados', count(*)::text FROM valores
UNION ALL SELECT 'coincidências com nomes de consignação', count(*)::text FROM trechos x JOIN alvo a ON a.h = x.h
UNION ALL SELECT 'colunas com coincidência', coalesce(string_agg(DISTINCT x.relacao, ', '), '-') FROM trechos x JOIN alvo a ON a.h = x.h;
ROLLBACK;
"@
$resultado = @(Invoke-Psql -Tuplas -Comando $sqlDw | Where-Object { $_.Trim() -ne '' })
$resultado | ForEach-Object { Write-Host ('   ' + $_.Replace('|', ' = ')) }
$coincidencias = [int](($resultado | Where-Object { $_ -like 'coincidências*' } | Select-Object -First 1).Split('|')[1])
if ($coincidencias -eq 0) {
    Write-Host 'Nenhum nome de pessoa encontrado no DW.' -ForegroundColor Green
} else {
    Write-Host "ATENÇÃO: $coincidencias coincidência(s) com nomes de consignação no DW." -ForegroundColor Red
    exit 1
}
