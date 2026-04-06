@echo off
setlocal

cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

echo Starting local server on port %PORT%...
start "" "http://127.0.0.1:%PORT%/"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\serve.ps1" -Port %PORT%

endlocal
