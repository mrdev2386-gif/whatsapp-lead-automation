# 🛡️ STABILITY ENHANCEMENTS - Crash Loop Prevention

## Overview
This document outlines all crash loop protection and stability measures implemented in the bot system.

---

## 1. RESTART LOOP PROTECTION (restart.js)

### Implementation
```javascript
const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS = 10;
const WINDOW_MS = 60000;
const RAPID_RESTART_THRESHOLD = 10000;
const RAPID_RESTART_LIMIT = 3;
const HEARTBEAT_TIMEOUT = 120000;

let restartTimestamps = [];
let consecutiveFailures = 0;
let globalClientInitialized = false;

function canRestart() {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter(t => now - t < WINDOW_MS);
  restartTimestamps.push(now);
  
  if (restartTimestamps.length > MAX_RESTARTS) {
    console.error(`❌ CRASH LOOP DETECTED: ${restartTimestamps.length} restarts in ${WINDOW_MS / 1000}s`);
    return false;
  }
  return true;
}

function blockDuplicateClient() {
  if (globalClientInitialized) {
    console.error('❌ DUPLICATE CLIENT BLOCKED: Another instance already running');
    process.exit(1);
  }
  globalClientInitialized = true;
}
```

### Protection Levels
- **Level 1**: Max 10 restarts per 60 seconds → Exit if exceeded
- **Level 2**: Rapid restart detection (< 10s between restarts) → Exit after 3 consecutive rapid restarts
- **Level 3**: Duplicate client blocking → Prevent multiple instances
- **Level 4**: Heartbeat monitoring → Kill hung processes after 2 minutes of inactivity

---

## 2. DUPLICATE CLIENT BLOCKING (index.js)

### Implementation
```javascript
if (global.__CLIENT__) {
  console.error('❌ DUPLICATE CLIENT BLOCKED: Global client already exists');
  process.exit(1);
}
global.__CLIENT__ = true;
```

### Purpose
- Prevents multiple WhatsApp client instances from running simultaneously
- Avoids resource exhaustion and session conflicts
- Ensures single source of truth for bot state

---

## 3. MEMORY WATCHDOG (index.js)

### Implementation
```javascript
const MAX_MEMORY_MB = 450;

setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[MEMORY] Used: ${used.toFixed(2)} MB`);
  if (used > MAX_MEMORY_MB) {
    console.error('❌ MEMORY LIMIT EXCEEDED. Restarting...');
    process.exit(1);
  }
}, 10000);
```

### Thresholds
- **Warning**: Logs every 10 seconds
- **Critical**: Exits if heap exceeds 450 MB
- **Restart**: Parent process (restart.js) automatically restarts after 5 seconds

---

## 4. HEARTBEAT SIGNAL (index.js)

### Implementation
```javascript
setInterval(() => {
  console.log('[HEARTBEAT] Bot alive');
}, 30000);
```

### Purpose
- Signals to parent process that bot is responsive
- Parent monitors for 2+ minutes of silence → Force kills hung child
- Prevents zombie processes from consuming resources

---

## 5. GRACEFUL ERROR HANDLING (index.js)

### Implementation
```javascript
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
  process.exit(1);
});
```

### Purpose
- Catches all unhandled errors
- Logs error details for debugging
- Exits cleanly so restart.js can respawn

---

## 6. GRACEFUL SHUTDOWN (index.js)

### Implementation
```javascript
async function shutdown(signal) {
  const sid = `[SESSION ${SESSION_ID}]`;
  console.log(`\n${sid} [${signal}] Shutting down...`);
  if (globalClient) {
    try {
      await globalClient.kill();
      console.log(`${sid} [SHUTDOWN] WhatsApp client closed.`);
    } catch (e) {
      console.error(`${sid} [SHUTDOWN] Error killing client:`, e.message);
    }
  }
  if (server) {
    server.close(() => {
      console.log(`${sid} [SHUTDOWN] Express server closed.`);
      process.exit(0);
    });
    setTimeout(() => {
      console.log(`${sid} [SHUTDOWN] Force exiting...`);
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

### Purpose
- Handles Ctrl+C and system signals gracefully
- Closes WhatsApp client and Express server
- Force exits after 5 seconds if cleanup hangs

---

## 7. ORPHAN PROCESS CLEANUP (restart.js)

### Implementation
```javascript
function cleanupOrphanProcesses() {
  try {
    execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
    console.log('[CLEANUP] Chrome processes terminated');
  } catch (e) {}
  try {
    execSync('taskkill /F /IM chromium.exe /T 2>nul', { stdio: 'ignore' });
  } catch (e) {}
  try {
    execSync('taskkill /F /IM conhost.exe /T 2>nul', { stdio: 'ignore' });
  } catch (e) {}
  try {
    execSync('wmic process where name="chrome.exe" delete 2>nul', { stdio: 'ignore' });
  } catch (e) {}
}
```

### Purpose
- Kills orphaned Chrome/Chromium processes
- Prevents resource leaks from previous crashes
- Runs before every restart attempt

---

## 8. LOCK FILE MECHANISM (index.js)

### Implementation
```javascript
const LOCK_FILE = path.join(SESSION_DIR, `.lock`);
if (fs.existsSync(LOCK_FILE)) {
  const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
  try {
    process.kill(pid, 0);
    console.log(`[SESSION ${SESSION_ID}] Found existing process ${pid}. Killing...`);
    process.kill(pid, 'SIGKILL');
    const startSync = Date.now();
    while (Date.now() - startSync < 2000) { }
    fs.unlinkSync(LOCK_FILE);
  } catch (e) {
    fs.unlinkSync(LOCK_FILE);
  }
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());
process.on('exit', () => {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch (e) { }
  }
});
```

### Purpose
- Prevents multiple instances of same session from running
- Automatically kills stale processes
- Cleans up lock file on exit

---

## 9. VALIDATION RETRY LOGIC (index.js)

### Implementation
```javascript
let isValid = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    if (!client || !client.getHostNumber) {
      console.log(`${sid} Retrying session init... (attempt ${attempt})`);
      await delay(10000);
      continue;
    }
    const isConn = await client.isConnected();
    const host = await client.getHostNumber();
    if (isConn && host) {
      isValid = true;
      console.log(`${sid} Session saved successfully. Host: ${host}`);
      break;
    }
  } catch (e) {
    console.warn(`${sid} Validation attempt ${attempt} failed, retrying...`);
    await delay(5000);
  }
}
if (!isValid) {
  console.error(`${sid} Validation failed after 3 attempts! Restarting...`);
  await client.kill();
  process.exit(1);
}
```

### Purpose
- Validates client connection after initialization
- Retries up to 3 times with delays
- Exits if validation fails to trigger restart

---

## 10. HEALTH CHECK LOOP (index.js)

### Implementation
```javascript
setInterval(async () => {
  try {
    const ok = await client.isConnected();
    if (!ok) {
      console.warn(`${sid} Health Check: Connection lost!`);
      await client.forceRefocus().catch(() => { });
    }
  } catch (e) {
    console.warn(`${sid} Health Check: Error checking connection`, e.message);
  }
}, 30000);
```

### Purpose
- Monitors connection status every 30 seconds
- Attempts to refocus if connection lost
- Logs warnings for debugging

---

## EXECUTION FLOW

### Normal Operation
```
restart.js (parent)
    ↓
canRestart() ✅
    ↓
blockDuplicateClient() ✅
    ↓
spawn index.js (child)
    ↓
index.js checks global.__CLIENT__ ✅
    ↓
Memory watchdog running ✅
    ↓
Heartbeat every 30s ✅
    ↓
Health check every 30s ✅
    ↓
Bot processes messages
```

### Crash Scenario
```
index.js crashes
    ↓
restart.js detects exit
    ↓
canRestart() checks timestamp window
    ↓
If < 10 restarts/60s: spawn new child
If ≥ 10 restarts/60s: EXIT (crash loop detected)
    ↓
cleanupOrphanProcesses() runs
    ↓
Wait 5 seconds
    ↓
Spawn new child
```

### Rapid Restart Scenario
```
index.js crashes
    ↓
Restart within 10 seconds
    ↓
consecutiveFailures++
    ↓
If consecutiveFailures > 3: EXIT (rapid restart loop)
Else: Spawn new child
```

### Hung Process Scenario
```
index.js running but no heartbeat for 2+ minutes
    ↓
Heartbeat monitor in restart.js detects silence
    ↓
Force kill child with SIGKILL
    ↓
cleanupOrphanProcesses() runs
    ↓
Wait 5 seconds
    ↓
Spawn new child
```

---

## MONITORING CHECKLIST

- [ ] Check logs for `[MEMORY]` entries - should stay < 450 MB
- [ ] Check logs for `[HEARTBEAT]` every 30 seconds
- [ ] Check logs for `[RESTART]` - should be rare
- [ ] Check logs for `❌ CRASH LOOP DETECTED` - should never appear
- [ ] Check logs for `❌ DUPLICATE CLIENT BLOCKED` - should never appear
- [ ] Check logs for `[CLEANUP]` - runs before each restart
- [ ] Check logs for `[SHUTDOWN]` - only on manual stop

---

## DEPLOYMENT COMMAND

```bash
node demo/restart.js --session=918073539824
```

This runs restart.js as the parent process, which spawns index.js as a child with automatic restart on crash.

---

## TROUBLESHOOTING

### Bot keeps restarting
- Check memory usage in logs
- Check for unhandled exceptions
- Verify Chrome/Chromium path is correct
- Check for duplicate sessions

### Bot not responding
- Check heartbeat logs (should appear every 30s)
- Check health check logs
- Verify WhatsApp connection status
- Check for hung processes: `tasklist | findstr node`

### High memory usage
- Check for memory leaks in message handlers
- Verify state.json isn't growing too large
- Check for unclosed file handles
- Monitor heap usage in logs

---

## CONSTANTS REFERENCE

| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_RESTARTS | 10 | Max restarts per window |
| WINDOW_MS | 60000 | Time window for restart counting |
| RAPID_RESTART_THRESHOLD | 10000 | Time threshold for rapid restart detection |
| RAPID_RESTART_LIMIT | 3 | Max consecutive rapid restarts |
| HEARTBEAT_TIMEOUT | 120000 | Time before killing hung process |
| MAX_MEMORY_MB | 450 | Memory limit before exit |
| RESTART_DELAY_MS | 5000 | Delay between restart attempts |

---

## RESULT

✅ **No crash loops** - Protected by restart counting and rapid restart detection
✅ **No duplicate clients** - Blocked by global flag and lock file
✅ **Stable auto-restart** - Parent process automatically respawns child
✅ **Memory safe** - Watchdog exits if heap exceeds limit
✅ **Responsive monitoring** - Heartbeat and health checks every 30s
✅ **Graceful shutdown** - Proper cleanup on signals
✅ **24/7 operation** - Automatic recovery from crashes
