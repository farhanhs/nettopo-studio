@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo {"code":"BTA_NODE_MISSING","message":"Install the tested Node.js version listed in QUICKSTART.zh-TW.md."}
  exit /b 2
)
node "%~dp0runtime\tools\start.mjs"
exit /b %errorlevel%
