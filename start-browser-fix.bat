@echo off
REM Browser Launch Fix - Startup with Memory Limit
REM Usage: start-browser-fix.bat YOUR_PHONE_NUMBER

setlocal enabledelayedexpansion

if "%1"=="" (
  echo Usage: start-browser-fix.bat YOUR_PHONE_NUMBER
  echo Example: start-browser-fix.bat 918073539824
  pause
  exit /b 1
)

set SESSION_ID=%1

echo.
echo ========================================
echo  BROWSER LAUNCH FIX - STARTUP
echo ========================================
echo.
echo [1/4] Killing background processes...
taskkill /F /IM chrome.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak

echo [2/4] Deleting old session...
if exist wa-%SESSION_ID% (
  rd /s /q wa-%SESSION_ID% 2>nul
  echo Deleted wa-%SESSION_ID%
)

echo [3/4] Clearing cache...
if exist node_modules\.cache (
  rd /s /q node_modules\.cache 2>nul
)

echo [4/4] Starting bot with memory limit...
echo.
echo ========================================
echo  SESSION: %SESSION_ID%
echo  MEMORY LIMIT: 512MB
echo  CHROME PATH: System Chrome
echo  ARGS: --no-sandbox --disable-gpu
echo ========================================
echo.
echo IMPORTANT:
echo - DO NOT touch mouse/keyboard during QR scan
echo - DO NOT switch windows
echo - WAIT 60-90 seconds after scanning QR
echo - Look for: STABLE READY ✅
echo.

node --max-old-space-size=512 demo/index.js --session=%SESSION_ID%

pause
