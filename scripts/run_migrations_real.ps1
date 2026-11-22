# =============================================================================
# run_migrations_real.ps1 — INICIALIZAÇÃO do DW REAL (esquemas staging, dw,
# bi e audit) no banco informado em PGDATABASE (dw_joalheria).
#
# Aplica, em ordem e de forma idempotente:
#   1. db/migrations/real/*.sql   (esquemas, tabelas, restrições, gatilhos)
#   2. etl/sql/app/*.sql          (funções e procedures do ETL real)
#   3. db/views/real/*.sql        (views do esquema bi)
#   4. db/seguranca/bi_leitura_real.sql (SELECT de bi_leitura no esquema bi)
# Registra cada arquivo e o SHA-256 em audit.migracao_aplicada.
#
# Não toca nos esquemas *_demo nem nos scripts da fase 1 (run_migrations.ps1
# continua aplicando só a fase 1). Não executa o ETL e não apaga dados.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\run_migrations_real.ps1
#       powershell -ExecutionPolicy Bypass -File scripts\run_migrations_real.ps1 -SomenteListar
# =============================================================================
param(
    [switch]$SomenteListar
)

. "$PSScriptRoot\_comum.ps1"

$arquivos = @()
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'db\migrations\real') -Filter '*.sql' | Sort-Object Name
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'etl\sql\app') -Filter '*.sql' | Sort-Object Name
$arquivos += Get-ChildItem -LiteralPath (Join-Path $RaizProjeto 'db\views\real') -Filter '*.sql' | Sort-Object Name
$arquivos += Get-Item -LiteralPath (Join-Path $RaizProjeto 'db\seguranca\bi_leitura_real.sql')

Write-Etapa 'Arquivos que serão aplicados (nesta ordem):'
foreach ($a in $arquivos) {
    Write-Host ('   ' + $a.FullName.Substring($RaizProjeto.Length + 1))
}
if ($SomenteListar) { return }

Import-ArquivoEnv
Test-VersaoServidor

# O controle (audit.migracao_aplicada) só existe depois de 102_audit.sql:
# arquivos aplicados antes disso ficam numa fila e são registrados em seguida.
function Test-ControleDisponivel {
    $r = (Invoke-Psql -Tuplas -Comando "SELECT to_regclass('audit.migracao_aplicada') IS NOT NULL;" | Select-Object -First 1)
    return ($null -ne $r -and $r.Trim() -eq 't')
}

function Get-HashRegistrado([string]$Relativo) {
    $r = Invoke-Psql -Tuplas -Comando "SELECT sha256 FROM audit.migracao_aplicada WHERE arquivo = $(ConvertTo-LiteralSql $Relativo);" | Select-Object -First 1
    if ($null -eq $r) { return $null }
    $t = $r.Trim()
    if ($t -eq '') { return $null }
    return $t
}

function Register-Migracao([string]$Relativo, [string]$Hash) {
    $sql = "INSERT INTO audit.migracao_aplicada (arquivo, sha256) VALUES ($(ConvertTo-LiteralSql $Relativo), '$Hash') " +
           "ON CONFLICT (arquivo) DO UPDATE SET sha256 = EXCLUDED.sha256, aplicado_em = clock_timestamp();"
    Invoke-Psql -Comando $sql | Out-Null
    Write-Host "   registrado em audit.migracao_aplicada (sha256 $($Hash.Substring(0, 12))...)"
}

$pendentes = New-Object System.Collections.ArrayList
$controle = Test-ControleDisponivel
$aplicados = 0
$advertencias = 0

foreach ($a in $arquivos) {
    $relativo = $a.FullName.Substring($RaizProjeto.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -LiteralPath $a.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

    if ($controle) {
        $hashAnterior = Get-HashRegistrado $relativo
        if ($null -ne $hashAnterior -and $hashAnterior -ne $hash) {
            $advertencias++
            Write-Warning ("$relativo mudou desde a última aplicação. Instruções CREATE ... IF NOT EXISTS não alteram " +
                           'objetos já existentes; avalie a necessidade de uma nova migration.')
        }
    }

    Write-Etapa "Aplicando $relativo"
    Invoke-Psql -Arquivo $a.FullName | Out-Null
    $aplicados++

    if (-not $controle) {
        $controle = Test-ControleDisponivel
        if (-not $controle) {
            [void]$pendentes.Add(@{ Relativo = $relativo; Hash = $hash })
            Write-Host '   aplicado; registro adiado (tabela de controle ainda não existe)'
            continue
        }
        foreach ($p in $pendentes) {
            Register-Migracao $p.Relativo $p.Hash
        }
        $pendentes.Clear()
    }
    Register-Migracao $relativo $hash
}

if ($pendentes.Count -gt 0) {
    throw "Migrations aplicadas sem registro: $(($pendentes | ForEach-Object { $_.Relativo }) -join ', ')"
}

Write-Etapa "Inicialização do DW real concluída: $aplicados arquivo(s) aplicado(s); $advertencias advertência(s) de hash."
Write-Host 'Próximo passo: scripts\run_etl_app.ps1'
