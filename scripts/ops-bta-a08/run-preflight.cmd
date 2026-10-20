@echo off
setlocal
set "A08_PWSH=C:\Users\DUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not exist "%A08_PWSH%" (
  echo A08 preflight requires the approved bundled PowerShell 7.6.5 path.>&2
  exit /b 2
)
"%A08_PWSH%" -NoProfile -File "%~dp0ops-bta-a08.ps1" -Mode Preflight %*
exit /b %errorlevel%
