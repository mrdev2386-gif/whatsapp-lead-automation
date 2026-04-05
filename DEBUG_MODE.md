# 🔍 DEBUG MODE - COMPREHENSIVE ERROR LOGGING

## Overview

Two debug scripts have been created to prevent terminal auto-close and expose real errors:

1. **restart_debug.js** - Debug version of restart.js (parent process)
2. **index_debug.js** - Debug wrapper for index.js (child process)

---

## Key Features

### ✅ Terminal Auto-Close Prevention
- All `process.exit()` calls are blocked
- Terminal stays open for 10 minutes after error
- Allows time to read and copy error messages

### ✅ Comprehensive Error Logging
- Catches uncaught exceptions
- Catches unhandled rejections
- Catches process warnings
- Logs full stack traces
- Logs error codes and details

### ✅ Enhanced Debugging Info
- Memory usage every 30 seconds
- Child process spawn details
- Signal handling logs
- Cleanup operation logs
- Heartbeat monitoring logs

---

## How to Run

### Option 1: Debug Parent Only (restart_debug.js)
```bash
node demo/restart_debug.js --session=916299261088
```

**What it does:**
- Runs debug version of restart.js
- Spawns normal index.js as child
- Logs all parent process errors
- Blocks exit on error

### Option 2: Debug Both (restart_debug.js + index_debug.js)
```bash
# Modify restart_debug.js to spawn index_debug.js instead of index.js
# Then run:
node demo/restart_debug.js --session=916299261088
```

**What it does:**
- Runs debug version of restart.js
- Spawns debug version of index.js as child
- Logs all errors from both processes
- Blocks exit on error

### Option 3: Debug Child Only (index_debug.js)
```bash
node demo/index_debug.js --session=916299261088
```

**What it does:**
- Runs debug wrapper for index.js
- Adds comprehensive error logging
- Loads original index.js
- Blocks exit on error

---

## What to Look For

### Startup Phase
```
═══════════════════════════════════════════════════════════════════════════════
🚀 RESTART.JS STARTED (DEBUG MODE)
═══════════════════════════════════════════════════════════════════════════════
Session ID: 916299261088
Max Restarts: 10
Window: 60s
Rapid Restart Threshold: 10s
Heartbeat Timeout: 120s
═══════════════════════════════════════════════════════════════════════════════
```

### Normal Operation
```
[RUN] Starting bot run cycle...
[CLEANUP] Starting orphan process cleanup...
[CLEANUP] ✅ Chrome processes terminated
[RUN] Spawning child: node --max-old-space-size=512 index.js --session=916299261088
[RUN] ✅ Child process spawned (PID: 12345)
```

### Error Detection
```
════════════════════════════════════════════════════════════════════════════════
🔴 CHILD PROCESS ERROR
════════════════════════════════════════════════════════════════════════════════
Error Name: Error
Error Message: ENOENT: no such file or directory, open 'C:\...\chrome.exe'
Error Code: ENOENT
════════════════════════════════════════════════════════════════════════════════
```

### Memory Monitoring
```
[MEMORY DEBUG] {
  heapUsed: '245 MB',
  heapTotal: '512 MB',
  external: '12 MB',
  rss: '580 MB'
}
```

### Child Exit
```
────────────────────────────────────────────────────────────────────────────────
[CHILD EXIT] Bot exited
  Exit Code: 1
  Signal: null
  Restarting in 5s...
────────────────────────────────────────────────────────────────────────────────
```

---

## Common Errors & Solutions

### Error: ENOENT: no such file or directory
```
Error Message: ENOENT: no such file or directory, open 'C:\...\chrome.exe'
```
**Cause:** Chrome/Chromium path is incorrect
**Solution:** Check CHROMIUM_PATH in index.js

### Error: EADDRINUSE: address already in use
```
Error Message: EADDRINUSE: address already in use :::8261
```
**Cause:** Port is already in use
**Solution:** Kill existing process or use different port

### Error: ECONNREFUSED: connection refused
```
Error Message: ECONNREFUSED: connection refused 127.0.0.1:9222
```
**Cause:** Chrome debugging port not available
**Solution:** Kill Chrome processes and restart

### Error: ETIMEDOUT: connection timed out
```
Error Message: ETIMEDOUT: connection timed out
```
**Cause:** Network or WhatsApp API timeout
**Solution:** Check internet connection and try again

### Error: ENOMEM: out of memory
```
Error Message: ENOMEM: out of memory
```
**Cause:** Process using too much memory
**Solution:** Increase --max-old-space-size or check for memory leaks

---

## Debug Output Sections

### 1. Uncaught Exception
```
════════════════════════════════════════════════════════════════════════════════
🔴 RESTART.JS UNCAUGHT EXCEPTION
════════════════════════════════════════════════════════════════════════════════
Error Name: TypeError
Error Message: Cannot read property 'kill' of null
Error Code: undefined
Stack Trace:
  at run (/path/to/restart.js:123:45)
  at Object.<anonymous> (/path/to/restart.js:456:1)
════════════════════════════════════════════════════════════════════════════════
```

### 2. Unhandled Rejection
```
════════════════════════════════════════════════════════════════════════════════
🔴 RESTART.JS UNHANDLED REJECTION
════════════════════════════════════════════════════════════════════════════════
Promise: Promise { <pending> }
Reason: Error: Connection failed
Error Name: Error
Error Message: Connection failed
Stack Trace:
  at async start (/path/to/index.js:2234:10)
════════════════════════════════════════════════════════════════════════════════
```

### 3. Process Warning
```
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
🟡 PROCESS WARNING
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
Timestamp: 2024-01-15T10:30:45.123Z
Name: MaxListenersExceededWarning
Message: Possible EventEmitter memory leak detected
Code: ERR_EVENT_EMITTER_MEMORY_LEAK
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
```

---

## How to Copy Error Messages

### Windows Terminal
1. Right-click on terminal
2. Select "Select All"
3. Right-click again
4. Select "Copy"
5. Paste into text editor

### PowerShell
```powershell
# Copy last 100 lines to clipboard
Get-Content | Select-Object -Last 100 | Set-Clipboard
```

### Command Prompt
```cmd
# Redirect output to file
node demo/restart_debug.js --session=916299261088 > debug_output.txt 2>&1
```

---

## Debug Checklist

- [ ] Run debug script in terminal (not double-click)
- [ ] Wait for bot to start or error to appear
- [ ] Read error message carefully
- [ ] Note error name, message, and code
- [ ] Check stack trace for file and line number
- [ ] Copy full error output
- [ ] Check memory usage logs
- [ ] Check child process spawn logs
- [ ] Check cleanup operation logs
- [ ] Terminal stays open for 10 minutes

---

## Expected Timeline

| Phase | Duration | What to See |
|-------|----------|------------|
| Startup | 5-10s | Debug header + startup logs |
| Cleanup | 2-3s | Orphan process cleanup logs |
| Spawn | 1-2s | Child process spawn logs |
| Chrome Launch | 15-20s | Chrome initialization |
| Session Hardening | 60s | Waiting for session |
| QR Code | 30-60s | QR code generation |
| Ready | 5-10s | STABLE READY message |
| Normal Op | Ongoing | Memory logs every 30s |

---

## Troubleshooting Debug Mode

### Terminal closes immediately
- Make sure you're running in terminal, not double-clicking
- Check for syntax errors in debug script
- Run: `node demo/restart_debug.js --session=916299261088`

### No error message appears
- Bot might be running successfully
- Check for memory logs (appears every 30s)
- Send test message "hi" to bot
- Check for heartbeat logs

### Error message is cut off
- Scroll up in terminal
- Use `> debug_output.txt 2>&1` to save to file
- Increase terminal buffer size

### Terminal doesn't stay open
- Check if error handler is working
- Verify `setTimeout(() => {}, 600000)` is in code
- Try running with explicit node path

---

## Next Steps After Finding Error

1. **Note the error details:**
   - Error name
   - Error message
   - Error code
   - Stack trace
   - Line number

2. **Search for solution:**
   - Google the error message
   - Check GitHub issues
   - Check documentation

3. **Fix the issue:**
   - Update configuration
   - Install missing dependencies
   - Fix file paths
   - Update environment variables

4. **Test the fix:**
   - Run debug script again
   - Verify error is gone
   - Check for new errors

5. **Run normal mode:**
   - Once working, run normal restart.js
   - Monitor for 1+ hour
   - Verify stability

---

## Debug Files Created

- `demo/restart_debug.js` - Debug version of restart.js
- `demo/index_debug.js` - Debug wrapper for index.js
- `DEBUG_MODE.md` - This file

---

## Important Notes

⚠️ **Debug mode is for troubleshooting only**
- Do NOT use in production
- Terminal will stay open for 10 minutes
- Memory usage will be higher
- Performance may be slower

✅ **Once issue is fixed:**
- Switch back to normal restart.js
- Run: `node demo/restart.js --session=916299261088`
- Monitor for stability

---

**Status:** Debug mode ready
**Purpose:** Find and expose real errors
**Duration:** 10 minutes per error
**Next:** Fix error and test with normal mode
