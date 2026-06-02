@echo off
title Your Mental Coach - Phone Preview (Cloudflare tunnel)
REM ---------------------------------------------------------------------------
REM Instant phone preview: runs the Vite dev server + a Cloudflare quick tunnel.
REM Open the https://SOMETHING.trycloudflare.com link (shown below) on your phone
REM (Safari). Edits you/Claude make on the PC appear in a few seconds (HMR).
REM No Cloudflare account needed. Works from anywhere, even on cellular.
REM Keep this window open while previewing. The link changes each time you run it.
REM ---------------------------------------------------------------------------
set "PATH=C:\Users\Nico Conte\AppData\Local\nodejs\node-v24.16.0-win-x64;%PATH%"
cd /d "%~dp0"
echo ================================================
echo    Your Mental Coach  -  Phone Preview
echo ================================================
echo.
echo 1) Starting the dev server in a separate window...
start "YMC Dev Server" cmd /k "node ""node_modules\vite\bin\vite.js"" --host --port 8080"
echo 2) Waiting for it to boot...
timeout /t 7 /nobreak >nul
echo.
echo 3) Starting the Cloudflare tunnel.
echo    Look below for a line like:  https://SOMETHING.trycloudflare.com
echo    Open THAT link on your phone in Safari.
echo.
echo    Keep this window open while you preview. Press Ctrl+C to stop the tunnel.
echo.
"%~dp0..\cloudflared.exe" tunnel --url http://localhost:8080
pause
