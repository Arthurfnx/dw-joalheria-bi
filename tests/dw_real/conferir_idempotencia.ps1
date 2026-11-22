# =============================================================================
# conferir_idempotencia.ps1 — critério 3 da T04: run_etl_app.ps1 executado duas
# vezes seguidas produz o mesmo DW (linhas e md5 de cada tabela de dw e view
# de bi) e registra as duas execuções em audit.
# Executa o ETL duas vezes (recarga completa autorizada de staging, dw e bi);
# as fotografias são somente leitura.
# Uso: powershell -ExecutionPolicy Bypass -File tests\dw_real\conferir_idempotencia.ps1
# =============================================================================
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv
$etl = Join-Path $PSScriptRoot '..\..\scripts\run_etl_app.ps1'
$foto = Join-Path $PSScriptRoot 'fotografia_dw.sql'

$fotos = @()
$execucoes = @()
foreach ($i in 1, 2) {
    Write-Etapa "Execução $i do ETL"
    & powershell -ExecutionPolicy Bypass -File $etl | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "run_etl_app.ps1 terminou com código $LASTEXITCODE na execução $i." }
    $execucoes += (Invoke-Psql -Tuplas -Comando "SELECT max(id_execucao) || ' ' || status FROM audit.execucao WHERE id_execucao = (SELECT max(id_execucao) FROM audit.execucao) GROUP BY status;" | Select-Object -First 1).Trim()
    $fotos += , @(Invoke-Psql -Tuplas -Arquivo $foto | Where-Object { $_.Trim() -ne '' })
    Write-Host "   audit.execucao: $($execucoes[-1]); $($fotos[-1].Count) tabelas/views fotografadas"
}

$diferencas = @(Compare-Object -ReferenceObject $fotos[0] -DifferenceObject $fotos[1])
Write-Etapa 'Contagens da segunda execução'
$fotos[1] | ForEach-Object { Write-Host ('   ' + ($_ -replace ' md5=.*$', '')) }
if ($diferencas.Count -eq 0 -and $execucoes[0] -ne $execucoes[1]) {
    Write-Host ''
    Write-Host "Idempotente: execuções $($execucoes -join ' e ') registradas; DW idêntico ($($fotos[1].Count) itens)." -ForegroundColor Green
} else {
    $diferencas | ForEach-Object { Write-Host ("   {0} {1}" -f $_.SideIndicator, $_.InputObject) }
    Write-Host 'DW diferente entre as duas execuções.' -ForegroundColor Red
    exit 1
}
