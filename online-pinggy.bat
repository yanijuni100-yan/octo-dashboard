@echo off
title Octo Dashboard - ONLINE (pinggy tunnel)
cd /d "%~dp0"
echo ===========================================================
echo   OCTO DASHBOARD - Mode ONLINE (tunnel pinggy via proxy)
echo ===========================================================
echo.
echo  1) Menyalakan server lokal di port 8080...
start "Octo Dashboard Server" cmd /c "node server.js"
timeout /t 3 >nul
echo  2) Membuka tunnel ke internet...
echo.
echo  URL publik akan muncul di bawah (tunggu ~10 detik).
echo  Catatan tunnel GRATIS pinggy:
echo    - Maksimal 60 menit per sesi, URL ganti tiap kali nyalain ulang
echo    - Pengunjung pertama lihat halaman peringatan pinggy -> klik lanjut
echo    - PC ini harus tetap nyala
echo  Tekan Ctrl+C untuk menghentikan.
echo ===========================================================
echo.
REM Lokasi kunci & proxy diambil dari variabel lingkungan supaya jalur pribadi
REM tidak ikut tersimpan di repo. Kalau punyamu ada di tempat lain, set dulu:
REM   setx PINGGY_KEY   "D:\folder-kamu\pinggy_key"
REM   setx PINGGY_PROXY "D:\folder-kamu\proxy-connect.js"
if not defined PINGGY_KEY   set "PINGGY_KEY=%USERPROFILE%\.ssh\pinggy_key"
if not defined PINGGY_PROXY set "PINGGY_PROXY=%USERPROFILE%\.ssh\proxy-connect.js"
if not exist "%PINGGY_KEY%" (
  echo  [!] Kunci tunnel tidak ditemukan di: %PINGGY_KEY%
  echo      Set dulu lokasinya: setx PINGGY_KEY "jalur\ke\pinggy_key"
  pause
  exit /b 1
)
ssh -p 443 -o "ProxyCommand=node ""%PINGGY_PROXY%"" %%h %%p" -i "%PINGGY_KEY%" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:8080 a.pinggy.io
echo.
echo Tunnel berhenti. Tekan tombol apa saja untuk keluar.
pause >nul
