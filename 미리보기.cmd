@echo off
setlocal
cd /d "%~dp0"
set "LAB_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "LAB_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%LAB_NODE%" scripts/build.mjs
if errorlevel 1 goto failed
echo.
echo Website: http://127.0.0.1:4173/
echo Editor:  http://127.0.0.1:4173/admin/
echo Keep this window open. Press Ctrl+C to stop.
echo.
"%LAB_NODE%" scripts/serve.mjs
goto done
:failed
echo Node.js 20 or newer is required. See README.md.
pause
:done
endlocal
