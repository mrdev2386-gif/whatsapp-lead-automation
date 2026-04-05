@echo off
REM WhatsApp Bot Startup - Windows Safe Version
REM Usage: start.bat [SESSION_ID]

setlocal enabledelayedexpansion

set SESSION_ID=main-session
if not "%1"=="" set SESSION_ID=%1

echo.
echo ========================================
echo  WhatsApp Bot Startup
echo  SESSION: %SESSION_ID%
echo ========================================
echo.

echo [1/4] Killing orphan Chrome processes...
taskkill /F /IM chrome.exe /T 2>nul
taskkill /F /IM chromium.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning session profile dir...
if exist wa-sessions\_IGNORE_main-session (
  node -e "require('fs').rmSync('wa-sessions/_IGNORE_main-session', {recursive:true, force:true}); console.log('[CLEANUP] Session profile cleared.');" 2>nul
)

echo [3/4] Removing stale lock file...
if exist wa-sessions\.lock del /f /q wa-sessions\.lock 2>nul

echo [4/4] Starting bot...
echo.
echo ========================================
echo  IMPORTANT:
echo  - Wait for QR code, scan with phone
echo  - Wait for: STABLE READY
echo  - Do NOT close this window
echo ========================================
echo.

node demo/restart.js --session=%SESSION_ID%

pause
