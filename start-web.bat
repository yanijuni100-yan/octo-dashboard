@echo off
title Octo Dashboard - Web Server
cd /d "%~dp0"
echo.
echo =========================================
echo   OCTO DASHBOARD - Mode Browser/Web
echo =========================================
echo.
echo  Buka di browser:
echo  http://localhost:8080
echo.
echo  Tekan Ctrl+C untuk hentikan server.
echo =========================================
echo.

REM Buka browser otomatis ke dashboard
start "" "http://localhost:8080"

REM Jalankan Python HTTP server di port 8080
python -m http.server 8080
pause
