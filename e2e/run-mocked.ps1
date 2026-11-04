$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$viteProcess = $null
$testExitCode = 1

try {
    $viteProcess = Start-Process `
        -FilePath 'node' `
        -ArgumentList 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1' `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 100; $attempt += 1) {
        if ($viteProcess.HasExited) {
            throw "Vite exited before becoming ready (exit code $($viteProcess.ExitCode))."
        }

        try {
            $response = Invoke-WebRequest `
                -Uri 'http://127.0.0.1:5173/login' `
                -UseBasicParsing `
                -TimeoutSec 1
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 200
        }
    }

    if (-not $ready) {
        throw 'Vite did not become ready at http://127.0.0.1:5173 within 20 seconds.'
    }

    & node 'node_modules/@playwright/test/cli.js' test
    $testExitCode = $LASTEXITCODE
}
finally {
    if ($null -ne $viteProcess -and -not $viteProcess.HasExited) {
        Stop-Process -Id $viteProcess.Id
        $null = $viteProcess.WaitForExit(5000)
    }
}

exit $testExitCode
