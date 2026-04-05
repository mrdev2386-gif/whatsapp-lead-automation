@echo off
REM Browser Launch Fix - Cleanup & Reinstall
REM Fixes "Failed to launch the browser process" error

echo.
echo ========================================
echo  BROWSER LAUNCH FIX - CLEANUP
echo ========================================
echo.

echo [1/6] Killing all Chrome processes...
taskkill /F /IM chrome.exe /T 2>nul
timeout /t 2 /nobreak

echo [2/6] Killing all Node processes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak

echo [3/6] Removing old session folders...
for /d %%D in (wa-*) do (
  echo Deleting %%D
  rd /s /q "%%D" 2>nul
)

echo [4/6] Clearing corrupted cache...
if exist node_modules\.cache (
  rd /s /q node_modules\.cache 2>nul
  echo Deleted node_modules\.cache
)

echo [5/6] Reinstalling Puppeteer (safe version)...
call npm install puppeteer@19 --save-exact
if errorlevel 1 (
  echo ERROR: Puppeteer installation failed
  pause
  exit /b 1
)

echo [6/6] Enabling High Performance mode...
powercfg -setactive SCHEME_MIN 2>nul

echo.
echo ========================================
echo  CLEANUP COMPLETE ✅
echo ========================================
echo.
echo Next: Run with memory limit:
echo   node --max-old-space-size=512 demo/index.js --session=YOUR_NUMBER
echo.
pause
