# =============================================================================
# criar_banco.ps1 — cria o banco PGDATABASE (ex.: dw_joalheria) no PostgreSQL
# 18.6 JÁ INSTALADO. Não instala nada e não altera bancos existentes.
#
# Execute somente quando autorizado. Conecta-se ao banco de manutenção
# 'postgres' para emitir CREATE DATABASE; se o banco já existir, nada é feito.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\criar_banco.ps1
# =============================================================================
param([switch]$Confirmar)

. "$PSScriptRoot\_comum.ps1"

Import-ArquivoEnv
$nome = $env:PGDATABASE
if ($nome -notmatch '^[a-z_][a-z0-9_]*$') {
    throw "Nome de banco '$nome' fora do padrão esperado (minúsculas, dígitos e _)."
}

$existe = (Invoke-Psql -Banco 'postgres' -Tuplas -Comando "SELECT count(*) FROM pg_database WHERE datname = $(ConvertTo-LiteralSql $nome);" | Select-Object -First 1).Trim()
if ($existe -eq '1') {
    Write-Host "O banco '$nome' já existe. Nada foi alterado."
    exit 0
}

Write-Host "Será criado o banco '$nome' em $($env:PGHOST):$($env:PGPORT) (ENCODING UTF8, TEMPLATE template0)."
if (-not $Confirmar) {
    $resposta = Read-Host 'Confirma a criação? (s/N)'
    if ($resposta -notin @('s', 'S', 'sim', 'SIM')) {
        Write-Host 'Operação cancelada.'
        exit 1
    }
}
Invoke-Psql -Banco 'postgres' -Comando "CREATE DATABASE $nome ENCODING 'UTF8' TEMPLATE template0;" | Out-Null
Write-Host "Banco '$nome' criado. Próximo passo: scripts\run_migrations.ps1" -ForegroundColor Green
