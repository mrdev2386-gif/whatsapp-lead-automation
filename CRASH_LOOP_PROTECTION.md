# 🚀 CRASH LOOP PROTECTION - QUICK START

## What's Protected

✅ **Restart Loop Protection** - Max 10 restarts per 60 seconds
✅ **Rapid Restart Detection** - Exits after 3 consecutive restarts < 10s apart
✅ **Duplicate Client Blocking** - Prevents multiple instances
✅ **Memory Watchdog** - Exits if heap exceeds 450 MB
✅ **Heartbeat Monitoring** - Kills hung processes after 2 minutes
✅ **Graceful Shutdown** - Proper cleanup on signals
✅ **Orphan Process Cleanup** - Kills stale Chrome processes
✅ **Lock File Mechanism** - Prevents session conflicts

---

## RUN WITH PROTECTION

### Option 1: With Restart Wrapper (RECOMMENDED)
```bash
node demo/restart.js --session=918073539824
```

**What happens:**
- restart.js runs as parent process
- Spawns index.js as child
- Auto-restarts on crash (up to 10 times per 60s)
- Exits if crash loop detected
- Cleans up orphan processes

### Option 2: Direct Run (No Auto-Restart)
```bash
node --max-old-space-size=512 demo/index.js --session=918073539824
```

**What happens:**
- Runs index.js directly
- Memory limit: 512 MB
- No auto-restart on crash
- Still has duplicate blocking & heartbeat

---

## MONITORING LOGS

### Look for these patterns:

**✅ Healthy Bot**
```
[MEMORY] Used: 245.32 MB
[HEARTBEAT] Bot alive
[HEALTH CHECK] Connection OK
```

**⚠️ Warning Signs**
```
[MEMORY] Used: 420.15 MB          ← Getting close to limit
[HEARTBEAT] No activity for 60s   ← Slowing down
[RESTART] Rapid restart #2        ← Multiple crashes
```

**❌ Critical Issues**
```
❌ CRASH LOOP DETECTED: 11 restarts in 60s
❌ DUPLICATE CLIENT BLOCKED: Another instance already running
❌ MEMORY LIMIT EXCEEDED. Restarting...
```

---

## CONSTANTS

Edit these in `demo/restart.js` if needed:

```javascript
const RESTART_DELAY_MS = 5000;        // Wait 5s between restarts
const MAX_RESTARTS = 10;              // Max 10 restarts per window
const WINDOW_MS = 60000;              // Per 60 seconds
const RAPID_RESTART_THRESHOLD = 10000; // Rapid = < 10s apart
const RAPID_RESTART_LIMIT = 3;        // Exit after 3 rapid restarts
const HEARTBEAT_TIMEOUT = 120000;     // Kill if no heartbeat for 2 min
```

Edit these in `demo/index.js` if needed:

```javascript
const MAX_MEMORY_MB = 450;            // Exit if heap > 450 MB
```

---

## TROUBLESHOOTING

### Bot keeps crashing
```bash
# Check logs for error pattern
# Look for: [UNCAUGHT EXCEPTION] or [UNHANDLED REJECTION]

# Kill all node processes
taskkill /F /IM node.exe /T

# Kill all chrome processes
taskkill /F /IM chrome.exe /T

# Run with restart wrapper
node demo/restart.js --session=918073539824
```

### Crash loop detected
```
❌ CRASH LOOP DETECTED: 11 restarts in 60s

# This means bot crashed 11 times in 60 seconds
# Possible causes:
# 1. Chrome path incorrect
# 2. Memory leak
# 3. Unhandled exception in message handler
# 4. WhatsApp API changes

# Fix:
# 1. Check Chrome path in index.js
# 2. Check memory logs
# 3. Check exception logs
# 4. Increase MAX_MEMORY_MB if needed
```

### Duplicate client blocked
```
❌ DUPLICATE CLIENT BLOCKED: Another instance already running

# This means another bot instance is already running
# Fix:
# 1. Kill all node processes: taskkill /F /IM node.exe /T
# 2. Delete lock file: del wa-918073539824\.lock
# 3. Run again: node demo/restart.js --session=918073539824
```

### High memory usage
```
[MEMORY] Used: 480.50 MB
❌ MEMORY LIMIT EXCEEDED. Restarting...

# Bot is using too much memory
# Possible causes:
# 1. Memory leak in message handler
# 2. state.json growing too large
# 3. Too many users in memory

# Fix:
# 1. Increase MAX_MEMORY_MB in index.js
# 2. Check for memory leaks in code
# 3. Archive old state.json
```

### No heartbeat
```
[HEARTBEAT] No activity for 120s. Child may be hung.
[HEARTBEAT] Force killing child process...

# Bot process is hung (not responding)
# Parent will kill it and restart

# This is normal if bot is processing heavy tasks
# If it happens frequently, check for blocking operations
```

---

## DEPLOYMENT

### Production Setup
```bash
# Terminal 1: Run bot with restart wrapper
node demo/restart.js --session=918073539824

# Terminal 2: Monitor logs (optional)
tail -f nohup.out | grep -E "\[MEMORY\]|\[HEARTBEAT\]|❌"
```

### Background Execution (Windows)
```bash
# Run in background with nohup
nohup node demo/restart.js --session=918073539824 > bot.log 2>&1 &

# Or use PM2
npm install -g pm2
pm2 start demo/restart.js --name "wa-bot" -- --session=918073539824
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "demo/restart.js", "--session=918073539824"]
```

---

## VERIFICATION CHECKLIST

- [ ] Bot starts without errors
- [ ] QR code appears in terminal
- [ ] Scan QR with phone
- [ ] See "STABLE READY ✅" message
- [ ] Heartbeat logs appear every 30s
- [ ] Memory stays < 450 MB
- [ ] Bot responds to test message "hi"
- [ ] No "CRASH LOOP DETECTED" messages
- [ ] No "DUPLICATE CLIENT BLOCKED" messages

---

## SUPPORT

For issues, check:
1. `STABILITY_ENHANCEMENTS.md` - Full documentation
2. Logs for error patterns
3. Chrome path configuration
4. Memory usage trends
5. Heartbeat frequency

---

**Status:** ✅ All protections active
**Last Updated:** 2024
**Version:** 1.0
