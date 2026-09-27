$paths = $env:PATH -split ';' | Where-Object { $_ -and ($_ -notmatch 'msys') }
$env:PATH = $paths -join ';'

$androidDir = Join-Path $PSScriptRoot "android"
Set-Location $androidDir

Write-Host "Filtered MSYS from PATH to prevent Android NDK Clang conflicts." -ForegroundColor Green
Write-Host "Running Gradle assembleDebug..." -ForegroundColor Cyan

.\gradlew.bat assembleDebug
