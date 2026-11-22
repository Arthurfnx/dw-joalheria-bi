# =============================================================================
# conferir_demo_intacto.ps1 — critério 2 da T04: as migrations do DW real não
# alteram nenhum objeto nem linha dos esquemas *_demo. SOMENTE LEITURA.
#
#   -Gravar <arquivo>   grava a fotografia atual (antes das migrations)
#   -Comparar <arquivo> compara a fotografia atual com a gravada
# =============================================================================
param(
    [string]$Gravar,
    [string]$Comparar
)
. (Join-Path $PSScriptRoot '..\..\scripts\_comum.ps1')
Import-ArquivoEnv

$foto = @(Invoke-Psql -Tuplas -Arquivo (Join-Path $PSScriptRoot 'fotografia_demo.sql') | Where-Object { $_.Trim() -ne '' })
Write-Host "Fotografia dos esquemas *_demo: $($foto.Count) linha(s)."

if ($Gravar) {
    [System.IO.File]::WriteAllLines($Gravar, [string[]]$foto, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Gravada em $Gravar"
}
if ($Comparar) {
    $anterior = @(Get-Content -LiteralPath $Comparar -Encoding UTF8 | Where-Object { $_.Trim() -ne '' })
    $diferencas = @(Compare-Object -ReferenceObject $anterior -DifferenceObject $foto)
    if ($diferencas.Count -eq 0) {
        Write-Host "Esquemas *_demo IDÊNTICOS à fotografia ($($anterior.Count) itens comparados)." -ForegroundColor Green
    } else {
        foreach ($d in $diferencas) { Write-Host ("   {0} {1}" -f $d.SideIndicator, $d.InputObject) }
        Write-Host "Esquemas *_demo DIFERENTES da fotografia: $($diferencas.Count) diferença(s)." -ForegroundColor Red
        exit 1
    }
}
