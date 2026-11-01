# =============================================================================
# registrar_preco_ouro.ps1 — registro ou CORREÇÃO VERSIONADA do preço do ouro
# 1000 em dw_demo.parametro_preco_ouro.
#
#  - Sem -Motivo: registra a versão 1 de uma data ainda sem preço.
#  - Com -Motivo: corrige a data criando a versão N+1 (a anterior deixa de ser
#    vigente; nada é apagado; entradas já registradas não são alteradas).
#
# Na demo, a unidade é NAO_CONFIRMADA_DEMO (não é cotação oficial).
#
# Uso:
#   scripts\registrar_preco_ouro.ps1 -Data 2025-03-10 -Valor 412.35
#   scripts\registrar_preco_ouro.ps1 -Data 2025-03-10 -Valor 415.00 -Motivo "Valor digitado incorretamente"
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Data,
    [Parameter(Mandatory = $true)][string]$Valor,
    [string]$Motivo,
    [switch]$Confirmar
)

. "$PSScriptRoot\_comum.ps1"

$cultura = [System.Globalization.CultureInfo]::InvariantCulture
$dataConvertida = [datetime]::MinValue
if (-not [datetime]::TryParseExact($Data, 'yyyy-MM-dd', $cultura, [System.Globalization.DateTimeStyles]::None, [ref]$dataConvertida)) {
    throw "Data inválida '$Data'. Use o formato AAAA-MM-DD."
}
$valorConvertido = [decimal]0
$valorNormalizado = $Valor.Replace(',', '.')
if (-not [decimal]::TryParse($valorNormalizado, [System.Globalization.NumberStyles]::Number, $cultura, [ref]$valorConvertido) -or $valorConvertido -le 0) {
    throw "Valor inválido '$Valor'. Informe um número positivo (ex.: 412.35)."
}
$dataSql = $dataConvertida.ToString('yyyy-MM-dd', $cultura)
$valorSql = $valorConvertido.ToString($cultura)

if ([string]::IsNullOrWhiteSpace($Motivo)) {
    $acao = "registrar o preço $valorSql para $dataSql (versão 1)"
    $sql = "CALL dw_demo.registrar_preco_ouro(DATE '$dataSql', $valorSql);"
} else {
    $acao = "CORRIGIR o preço de $dataSql para $valorSql (nova versão; motivo: $Motivo)"
    $sql = "CALL dw_demo.corrigir_preco_ouro(DATE '$dataSql', $valorSql, $(ConvertTo-LiteralSql $Motivo));"
}

Import-ArquivoEnv
Write-Host "Ação: $acao"
if (-not $Confirmar) {
    $resposta = Read-Host 'Confirma? (s/N)'
    if ($resposta -notin @('s', 'S', 'sim', 'SIM')) {
        Write-Host 'Operação cancelada.'
        exit 1
    }
}
Invoke-Psql -Comando $sql | Out-Null
Write-Host 'Operação concluída.' -ForegroundColor Green
