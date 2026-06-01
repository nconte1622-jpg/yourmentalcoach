@echo off
title Your Mental Coach - Dev Server
REM Put the portable Node on PATH (works even from an old shell), then start Vite.
set "PATH=C:\Users\Nico Conte\AppData\Local\nodejs\node-v24.16.0-win-x64;%PATH%"
cd /d "%~dp0"
echo ============================================
echo    Your Mental Coach  -  Local Dev Server
echo ============================================
echo.
echo Starting Vite. When it says "ready", open this in Chrome or Edge:
echo.
echo     http://localhost:8080
echo.
echo Press Ctrl+C in this window to stop the server.
echo.
node "node_modules\vite\bin\vite.js" --host --port 8080
echo.
echo Server stopped.
pause
