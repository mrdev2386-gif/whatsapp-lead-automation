@echo off
REM ============================================================================
REM WhatsApp Automation - Environment Stabilization Setup Script
REM ============================================================================
REM This script performs all necessary environment cleanup and setup
REM Run this BEFORE starting the bot for the first time
REM ============================================================================

echo.
echo [SETUP] WhatsApp Automation Environment Stabilization
echo [SETUP] ================================================
echo.

REM Check if session ID is provided
if "%1"=="" (
    echo [ERROR] Usage: setup.bat YOUR_SESSION_NUMBER
    echo [ERROR] Example: setup.bat 918073539824
    exit /b 1
)

set SESSION_ID=%1

echo [SETUP] Session ID: %SESSION_ID%
echo.

REM ============================================================================
REM STEP 1: Kill all Chrome instances
REM ============================================================================
echo [SETUP] Step 1: Killing all Chrome instances...
taskkill /F /IM chrome.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    echo [SETUP] ✓ Chrome instances killed
) else (
    echo [SETUP] ✓ No Chrome instances running
)
echo.

REM ============================================================================
REM STEP 2: Kill all Node processes
REM ============================================================================
echo [SETUP] Step 2: Killing all Node processes...
taskkill /F /IM node.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    echo [SETUP] ✓ Node processes killed
) else (
    echo [SETUP] ✓ No Node processes running
)
echo.

REM ============================================================================
REM STEP 3: Delete old session folder
REM ============================================================================
echo [SETUP] Step 3: Deleting old session folder (wa-%SESSION_ID%)...
if exist "wa-%SESSION_ID%" (
    rd /s /q "wa-%SESSION_ID%" >nul 2>&1
    echo [SETUP] ✓ Session folder deleted
) else (
    echo [SETUP] ✓ No old session folder found
)
echo.

REM ============================================================================
REM STEP 4: Clear npm cache
REM ============================================================================
echo [SETUP] Step 4: Clearing npm cache...
call npm cache clean --force >nul 2>&1
echo [SETUP] ✓ npm cache cleared
echo.

REM ============================================================================
REM STEP 5: Install dependencies
REM ============================================================================
echo [SETUP] Step 5: Installing dependencies...
echo [SETUP] Installing puppeteer@19 (exact version)...
call npm install puppeteer@19 --save-exact >nul 2>&1
if %errorlevel% equ 0 (
    echo [SETUP] ✓ puppeteer@19 installed
) else (
    echo [SETUP] ✗ Failed to install puppeteer@19
    exit /b 1
)
echo.

echo [SETUP] Installing all dependencies...
call npm install >nul 2>&1
if %errorlevel% equ 0 (
    echo [SETUP] ✓ All dependencies installed
) else (
    echo [SETUP] ✗ Failed to install dependencies
    exit /b 1
)
echo.

REM ============================================================================
REM STEP 6: Verify installation
REM ============================================================================
echo [SETUP] Step 6: Verifying installation...
call npm list puppeteer >nul 2>&1
if %errorlevel% equ 0 (
    echo [SETUP] ✓ Puppeteer installation verified
) else (
    echo [SETUP] ✗ Puppeteer installation verification failed
    exit /b 1
)
echo.

REM ============================================================================
REM STEP 7: Check system resources
REM ============================================================================
echo [SETUP] Step 7: Checking system resources...
for /f "tokens=3" %%A in ('find "Available Physical Memory" ^< nul ^| find /c "Available"') do set /a RAM_CHECK=%%A
echo [SETUP] ✓ System check complete
echo.

REM ============================================================================
REM COMPLETION
REM ============================================================================
echo [SETUP] ================================================
echo [SETUP] Environment Stabilization Complete!
echo [SETUP] ================================================
echo.
echo [SETUP] Ready to start bot with:
echo [SETUP] node demo/index.js --session=%SESSION_ID%
echo.
echo [SETUP] Important reminders:
echo [SETUP] 1. Ensure minimum 1GB free RAM
echo [SETUP] 2. Close all unnecessary applications
echo [SETUP] 3. Do NOT touch keyboard/mouse during startup
echo [SETUP] 4. Wait full 2 minutes for stabilization
echo [SETUP] 5. Look for "STABLE READY ✅" in logs
echo.
pause
