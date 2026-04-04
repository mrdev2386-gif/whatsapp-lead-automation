#!/bin/bash

# ============================================================================
# WhatsApp Automation - Environment Stabilization Setup Script (Linux/Mac)
# ============================================================================
# This script performs all necessary environment cleanup and setup
# Run this BEFORE starting the bot for the first time
# ============================================================================

echo ""
echo "[SETUP] WhatsApp Automation Environment Stabilization"
echo "[SETUP] ================================================"
echo ""

# Check if session ID is provided
if [ -z "$1" ]; then
    echo "[ERROR] Usage: ./setup.sh YOUR_SESSION_NUMBER"
    echo "[ERROR] Example: ./setup.sh 918073539824"
    exit 1
fi

SESSION_ID=$1

echo "[SETUP] Session ID: $SESSION_ID"
echo ""

# ============================================================================
# STEP 1: Kill all Chrome instances
# ============================================================================
echo "[SETUP] Step 1: Killing all Chrome instances..."
pkill -f "chrome" 2>/dev/null || true
pkill -f "chromium" 2>/dev/null || true
if [ $? -eq 0 ]; then
    echo "[SETUP] ✓ Chrome instances killed"
else
    echo "[SETUP] ✓ No Chrome instances running"
fi
echo ""

# ============================================================================
# STEP 2: Kill all Node processes
# ============================================================================
echo "[SETUP] Step 2: Killing all Node processes..."
pkill -f "node" 2>/dev/null || true
if [ $? -eq 0 ]; then
    echo "[SETUP] ✓ Node processes killed"
else
    echo "[SETUP] ✓ No Node processes running"
fi
echo ""

# ============================================================================
# STEP 3: Delete old session folder
# ============================================================================
echo "[SETUP] Step 3: Deleting old session folder (wa-$SESSION_ID)..."
if [ -d "wa-$SESSION_ID" ]; then
    rm -rf "wa-$SESSION_ID"
    echo "[SETUP] ✓ Session folder deleted"
else
    echo "[SETUP] ✓ No old session folder found"
fi
echo ""

# ============================================================================
# STEP 4: Clear npm cache
# ============================================================================
echo "[SETUP] Step 4: Clearing npm cache..."
npm cache clean --force >/dev/null 2>&1
echo "[SETUP] ✓ npm cache cleared"
echo ""

# ============================================================================
# STEP 5: Install dependencies
# ============================================================================
echo "[SETUP] Step 5: Installing dependencies..."
echo "[SETUP] Installing puppeteer@19 (exact version)..."
npm install puppeteer@19 --save-exact >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[SETUP] ✓ puppeteer@19 installed"
else
    echo "[SETUP] ✗ Failed to install puppeteer@19"
    exit 1
fi
echo ""

echo "[SETUP] Installing all dependencies..."
npm install >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[SETUP] ✓ All dependencies installed"
else
    echo "[SETUP] ✗ Failed to install dependencies"
    exit 1
fi
echo ""

# ============================================================================
# STEP 6: Verify installation
# ============================================================================
echo "[SETUP] Step 6: Verifying installation..."
npm list puppeteer >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[SETUP] ✓ Puppeteer installation verified"
else
    echo "[SETUP] ✗ Puppeteer installation verification failed"
    exit 1
fi
echo ""

# ============================================================================
# STEP 7: Check system resources
# ============================================================================
echo "[SETUP] Step 7: Checking system resources..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    FREE_RAM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    echo "[SETUP] ✓ System check complete (macOS)"
else
    # Linux
    FREE_RAM=$(free -m | awk 'NR==2{print $7}')
    echo "[SETUP] ✓ System check complete (Linux)"
fi
echo ""

# ============================================================================
# COMPLETION
# ============================================================================
echo "[SETUP] ================================================"
echo "[SETUP] Environment Stabilization Complete!"
echo "[SETUP] ================================================"
echo ""
echo "[SETUP] Ready to start bot with:"
echo "[SETUP] node demo/index.js --session=$SESSION_ID"
echo ""
echo "[SETUP] Important reminders:"
echo "[SETUP] 1. Ensure minimum 1GB free RAM"
echo "[SETUP] 2. Close all unnecessary applications"
echo "[SETUP] 3. Do NOT touch keyboard/mouse during startup"
echo "[SETUP] 4. Wait full 2 minutes for stabilization"
echo "[SETUP] 5. Look for \"STABLE READY ✅\" in logs"
echo ""
