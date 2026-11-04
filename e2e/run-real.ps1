$ErrorActionPreference = 'Stop'
$requiredOptIn = 'CONFIRM_ISOLATED_REAL_E2E'
$requiredPreflight = 'CONFIRM_DATABASE_AND_BASELINE_VERIFIED'
$requiredRegistration = 'CONFIRM_ONE_SYNTHETIC_USER'
$requiredMutations = 'CONFIRM_CREATED_RESOURCES_ONLY'
$requiredBaseUrl = 'http://127.0.0.1:5173'

if ($env:CODEPROGRESS_REAL_E2E_OPT_IN -ne $requiredOptIn) {
    throw 'Real-backend E2E is disabled: explicit opt-in is missing.'
}
if ($env:CODEPROGRESS_REAL_E2E_PREFLIGHT -ne $requiredPreflight) {
    throw 'Real-backend E2E is disabled: database and SQL baseline preflight is not acknowledged.'
}
if ($env:CODEPROGRESS_REAL_E2E_ALLOW_REGISTRATION -ne $requiredRegistration) {
    throw 'Real-backend E2E is disabled: synthetic registration is not explicitly authorized.'
}
if ($env:CODEPROGRESS_REAL_E2E_ALLOW_MUTATIONS -ne $requiredMutations) {
    throw 'Real-backend E2E is disabled: current-run resource mutations are not explicitly authorized.'
}
if (
    [string]::IsNullOrWhiteSpace($env:CODEPROGRESS_REAL_E2E_DATABASE) -or
    $env:CODEPROGRESS_REAL_E2E_DATABASE -notmatch '^[A-Za-z0-9_-]{3,63}$' -or
    $env:CODEPROGRESS_REAL_E2E_DATABASE -match '(?i)(prod|production|legacy)'
) {
    throw 'Real-backend E2E is disabled: isolated test database identifier is missing or unsafe.'
}
if ($env:CODEPROGRESS_REAL_E2E_BASELINE -notmatch '^users=\d+,topics=\d+,learning_tasks=\d+,study_sessions=\d+$') {
    throw 'Real-backend E2E is disabled: an exact externally verified SQL baseline is required.'
}
if ($env:CODEPROGRESS_REAL_E2E_BASE_URL -ne $requiredBaseUrl) {
    throw 'Real-backend E2E is disabled: baseURL must be http://127.0.0.1:5173.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$viteProcess = $null
$testExitCode = 1

try {
    $health = Invoke-WebRequest `
        -Uri 'http://127.0.0.1:8080/api/health' `
        -UseBasicParsing `
        -TimeoutSec 5
    if ($health.StatusCode -ne 200) {
        throw "Backend health returned HTTP $($health.StatusCode)."
    }

    $existingVite = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if ($null -ne $existingVite) {
        throw 'Port 5173 is already occupied. The real E2E runner will not reuse an unknown server.'
    }

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
                -Uri "$requiredBaseUrl/login" `
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
        throw "Vite did not become ready at $requiredBaseUrl within 20 seconds."
    }

    & node 'node_modules/@playwright/test/cli.js' test `
        '--config=playwright.real.config.ts' `
        '--project=real-backend'
    $testExitCode = $LASTEXITCODE
}
finally {
    if ($null -ne $viteProcess -and -not $viteProcess.HasExited) {
        Stop-Process -Id $viteProcess.Id
        $null = $viteProcess.WaitForExit(5000)
    }
}

exit $testExitCode
