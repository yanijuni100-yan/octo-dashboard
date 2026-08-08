@echo off
cd /d "%~dp0"
REM Pastikan Electron TIDAK berjalan sebagai Node (kalau tidak, ipcMain undefined)
set ELECTRON_RUN_AS_NODE=
REM Build versi terbaru lalu jalankan app hasil build (folder out\)
call npm run build
if errorlevel 1 (
  echo Build gagal. Cek pesan di atas.
  pause
  exit /b 1
)
"%~dp0node_modules\electron\dist\electron.exe" .
