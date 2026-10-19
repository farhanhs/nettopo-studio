@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo {"code":"BTA_NODE_MISSING","message":"Node.js is required to verify ownership before stopping."}
  exit /b 2
)
node "%~dp0runtime\tools\stop.mjs"
exit /b %errorlevel%
