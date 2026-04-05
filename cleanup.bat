@echo off
REM Low-RAM Stabilization: Delete old sessions and cache
REM Run this BEFORE starting the bot

echo [CLEANUP] Removing old sessions...
for /d %%D in (wa-*) do (
  echo Deleting %%D
  rd /s /q "%%D" 2>nul
)

echo [CLEANUP] Removing node_modules cache...
if exist node_modules\.cache (
  rd /s /q node_modules\.cache 2>nul
)

echo [CLEANUP] Killing existing Chrome processes...
taskkill /F /IM chrome.exe /T 2>nul

echo [CLEANUP] Killing existing Node processes...
taskkill /F /IM node.exe /T 2>nul

echo [CLEANUP] Enabling High Performance mode...
powercfg -setactive SCHEME_MIN 2>nul

echo [CLEANUP] Done! System ready for bot startup.
echo.
echo Next: Run: node demo/index.js --session=YOUR_NUMBER
pause
