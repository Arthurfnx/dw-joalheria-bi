# =============================================================================
# _comum.ps1 — funções compartilhadas pelos scripts do ambiente DEMONSTRATIVO.
# Carregado com: . "$PSScriptRoot\_comum.ps1"
# Compatível com Windows PowerShell 5.1 e PowerShell 7.
# =============================================================================

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RaizProjeto = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Os scripts são salvos em UTF-8 com BOM (exigência do Windows PowerShell 5.1
# para acentos). A saída do psql (PGCLIENTENCODING=UTF8) é decodificada em UTF-8.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Import-ArquivoEnv {
    <# Lê KEY=VALOR do .env local (sem imprimir valores) e define variáveis de ambiente do processo. #>
    param([string]$Caminho = (Join-Path $script:RaizProjeto '.env'))
    if (-not (Test-Path -LiteralPath $Caminho)) {
        throw "Arquivo .env não encontrado em '$Caminho'. Copie .env.example para .env e preencha localmente."
    }
    foreach ($linha in Get-Content -LiteralPath $Caminho -Encoding UTF8) {
        $texto = $linha.Trim()
        if ($texto -eq '' -or $texto.StartsWith('#')) { continue }
        $pos = $texto.IndexOf('=')
        if ($pos -lt 1) { continue }
        $chave = $texto.Substring(0, $pos).Trim()
        $valor = $texto.Substring($pos + 1).Trim()
        if (($valor.StartsWith('"') -and $valor.EndsWith('"')) -or ($valor.StartsWith("'") -and $valor.EndsWith("'"))) {
            $valor = $valor.Substring(1, $valor.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($chave, $valor, 'Process')
    }
    foreach ($obrigatoria in @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER')) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($obrigatoria, 'Process'))) {
            throw "Variável obrigatória '$obrigatoria' ausente no .env."
        }
    }
    $env:PGCLIENTENCODING = 'UTF8'
    $env:PGAPPNAME = 'dw-joalheria-demo'
}

function Get-CaminhoPsql {
    <# Localiza o psql: primeiro em PG_BIN, depois no PATH. Não instala nada. #>
    if (-not [string]::IsNullOrWhiteSpace($env:PG_BIN)) {
        $candidato = Join-Path $env:PG_BIN 'psql.exe'
        if (Test-Path -LiteralPath $candidato) { return $candidato }
        throw "PG_BIN definido ('$($env:PG_BIN)'), mas psql.exe não foi encontrado nessa pasta."
    }
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { return $cmd.Source }
    throw "psql não encontrado. Defina PG_BIN no .env (ex.: C:\Program Files\PostgreSQL\18\bin)."
}

function Invoke-Psql {
    <#
      Executa um arquivo (-Arquivo) ou um comando (-Comando) com ON_ERROR_STOP.
      -Tuplas devolve a saída sem cabeçalho (modo -t -A). -Banco sobrescreve PGDATABASE.
      -Comando NÃO é passado por argumento (-c): o Windows PowerShell 5.1 converte
      argumentos de programas nativos para a página de código ANSI, corrompendo
      acentos. O comando é gravado em arquivo temporário UTF-8 sem BOM, executado
      com -f e apagado no bloco finally.
    #>
    param(
        [string]$Arquivo,
        [string]$Comando,
        [switch]$Tuplas,
        [string]$Banco,
        [switch]$MostrarMensagens
    )
    $psql = Get-CaminhoPsql
    $env:PGCLIENTENCODING = 'UTF8'
    $argumentos = @('-X', '-q', '-v', 'ON_ERROR_STOP=1')
    if ($Banco) { $argumentos += @('-d', $Banco) }
    if ($Tuplas) { $argumentos += @('-t', '-A') }
    $arquivoTemporario = $null
    if ($Arquivo) {
        $argumentos += @('-f', $Arquivo)
    } elseif ($Comando) {
        $arquivoTemporario = Join-Path ([System.IO.Path]::GetTempPath()) ('dwj_psql_' + [guid]::NewGuid().ToString('N') + '.sql')
        $argumentos += @('-f', $arquivoTemporario)
    } else {
        throw 'Invoke-Psql: informe -Arquivo ou -Comando.'
    }
    # No Windows PowerShell 5.1, mensagens do psql em stderr (NOTICE) viram
    # ErrorRecord; com ErrorActionPreference=Stop isso abortaria o script.
    # O sucesso é decidido exclusivamente pelo código de saída do psql.
    $preferenciaAnterior = $ErrorActionPreference
    try {
        if ($arquivoTemporario) {
            [System.IO.File]::WriteAllText($arquivoTemporario, $Comando, (New-Object System.Text.UTF8Encoding($false)))
        }
        $ErrorActionPreference = 'Continue'
        $saida = & $psql @argumentos 2>&1
        $codigo = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $preferenciaAnterior
        if ($arquivoTemporario -and (Test-Path -LiteralPath $arquivoTemporario)) {
            Remove-Item -LiteralPath $arquivoTemporario -Force -ErrorAction SilentlyContinue
        }
    }
    $mensagens = @($saida | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.ToString() })
    $resultado = @($saida | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.ToString() })
    if ($codigo -ne 0) {
        throw ("psql retornou código $codigo." + [Environment]::NewLine + (($mensagens + $resultado) -join [Environment]::NewLine))
    }
    if ($MostrarMensagens) {
        foreach ($m in $mensagens) { Write-Host ('   ' + $m) }
    }
    return $resultado
}

function Test-VersaoServidor {
    <# Confirma conexão e informa a versão do servidor (esperado: PostgreSQL 18). #>
    $versao = (Invoke-Psql -Comando 'SHOW server_version_num;' -Tuplas | Select-Object -First 1).ToString().Trim()
    $numero = [int]$versao
    if ($numero -lt 180000) {
        Write-Warning "Servidor PostgreSQL com versão $versao. O projeto foi preparado para o PostgreSQL 18.6."
    } else {
        Write-Host "Conectado ao PostgreSQL (server_version_num=$versao)."
    }
}

function ConvertTo-LiteralSql {
    <# Escapa um texto como literal SQL ('...'). #>
    param([string]$Texto)
    if ($null -eq $Texto) { return 'NULL' }
    return "'" + $Texto.Replace("'", "''") + "'"
}

function Write-Etapa {
    param([string]$Mensagem)
    Write-Host ''
    Write-Host ("==> " + $Mensagem) -ForegroundColor Cyan
}
