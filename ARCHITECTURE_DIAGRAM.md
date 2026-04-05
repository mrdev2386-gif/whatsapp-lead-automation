# 🏗️ CRASH LOOP PROTECTION - ARCHITECTURE DIAGRAM

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RESTART.JS (Parent Process)                 │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Restart Loop Protection                                  │   │
│  │ • Track restart timestamps                              │   │
│  │ • Max 10 restarts per 60 seconds                        │   │
│  │ • Exit if limit exceeded                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Rapid Restart Detection                                  │   │
│  │ • Detect restarts < 10 seconds apart                    │   │
│  │ • Exit after 3 consecutive rapid restarts              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Duplicate Client Blocking                                │   │
│  │ • Check globalClientInitialized flag                    │   │
│  │ • Exit if already set                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Orphan Process Cleanup                                   │   │
│  │ • Kill Chrome processes                                 │   │
│  │ • Kill Chromium processes                               │   │
│  │ • Runs before each restart                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Heartbeat Monitoring                                     │   │
│  │ • Monitor child heartbeat every 30s                     │   │
│  │ • Kill child if no heartbeat for 2+ minutes            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Child Process Management                                 │   │
│  │ • Spawn index.js as child                               │   │
│  │ • Monitor exit code                                     │   │
│  │ • Auto-restart on exit                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Spawn Child    │
                    │   index.js      │
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     INDEX.JS (Child Process)                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Duplicate Client Blocking                                │   │
│  │ • Check global.__CLIENT__ flag                          │   │
│  │ • Exit if already set                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Memory Watchdog (Every 10s)                              │   │
│  │ • Monitor heap memory usage                             │   │
│  │ • Exit if > 450 MB                                      │   │
│  │ • Parent will restart                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Heartbeat Signal (Every 30s)                             │   │
│  │ • Log "Bot alive"                                       │   │
│  │ • Signal to parent that child is responsive             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Health Check Loop (Every 30s)                            │   │
│  │ • Check WhatsApp connection status                       │   │
│  │ • Refocus if connection lost                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Lock File Mechanism                                      │   │
│  │ • Create lock file on startup                           │   │
│  │ • Kill stale process if lock exists                     │   │
│  │ • Delete lock on exit                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Validation Retry Logic                                   │   │
│  │ • Validate client connection                            │   │
│  │ • Retry up to 3 times with delays                       │   │
│  │ • Exit if validation fails                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Error Handlers                                           │   │
│  │ • Catch uncaught exceptions                             │   │
│  │ • Catch unhandled rejections                            │   │
│  │ • Exit cleanly                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Graceful Shutdown                                        │   │
│  │ • Handle SIGINT (Ctrl+C)                                │   │
│  │ • Handle SIGTERM (system signal)                        │   │
│  │ • Close client and server                               │   │
│  │ • Force exit after 5 seconds                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Message Processing                                       │   │
│  │ • Receive WhatsApp messages                             │   │
│  │ • Process with AI/FAQ logic                             │   │
│  │ • Send responses                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Normal Operation Flow

```
START
  ↓
restart.js starts
  ├─ canRestart() ✅
  ├─ blockDuplicateClient() ✅
  ├─ cleanupOrphanProcesses() ✅
  └─ spawn index.js
       ↓
       index.js starts
       ├─ Check global.__CLIENT__ ✅
       ├─ Start memory watchdog ✅
       ├─ Start heartbeat (30s) ✅
       ├─ Start health check (30s) ✅
       ├─ Create lock file ✅
       ├─ Validate connection (3 retries) ✅
       └─ Ready for messages
            ↓
            NORMAL OPERATION
            ├─ Memory: 245 MB ✅
            ├─ Heartbeat: Every 30s ✅
            ├─ Health: Connected ✅
            └─ Messages: Processing
                 ↓
                 [Continues indefinitely]
```

---

## Crash & Restart Flow

```
index.js running
  ↓
[Crash occurs]
  ├─ Uncaught exception
  ├─ Unhandled rejection
  ├─ Memory limit exceeded
  └─ Any fatal error
       ↓
       Exit code 1
       ↓
       restart.js detects exit
       ├─ Check canRestart()
       │  ├─ Count restart timestamp
       │  ├─ If > 10 in 60s: EXIT (crash loop)
       │  └─ Else: Continue
       ├─ Check rapid restart
       │  ├─ If < 10s since last: consecutiveFailures++
       │  ├─ If > 3 consecutive: EXIT (rapid loop)
       │  └─ Else: Continue
       ├─ cleanupOrphanProcesses()
       ├─ Wait 5 seconds
       └─ spawn index.js again
            ↓
            [Repeat cycle]
```

---

## Crash Loop Detection

```
Crash 1 (0ms)
  ↓ [5s delay]
Crash 2 (5000ms)
  ↓ [5s delay]
Crash 3 (10000ms)
  ↓ [5s delay]
Crash 4 (15000ms)
  ↓ [5s delay]
Crash 5 (20000ms)
  ↓ [5s delay]
Crash 6 (25000ms)
  ↓ [5s delay]
Crash 7 (30000ms)
  ↓ [5s delay]
Crash 8 (35000ms)
  ↓ [5s delay]
Crash 9 (40000ms)
  ↓ [5s delay]
Crash 10 (45000ms)
  ↓ [5s delay]
Crash 11 (50000ms)
  ↓
❌ CRASH LOOP DETECTED: 11 restarts in 60s
  ↓
EXIT PROCESS
```

---

## Rapid Restart Detection

```
Crash 1 (0ms)
  ↓ [2s delay - RAPID!]
Crash 2 (2000ms)
  ├─ consecutiveFailures = 1
  ├─ ⚠️ RAPID RESTART #1
  ↓ [3s delay - RAPID!]
Crash 3 (5000ms)
  ├─ consecutiveFailures = 2
  ├─ ⚠️ RAPID RESTART #2
  ↓ [2s delay - RAPID!]
Crash 4 (7000ms)
  ├─ consecutiveFailures = 3
  ├─ ⚠️ RAPID RESTART #3
  ↓
❌ RAPID RESTART LOOP DETECTED
  ↓
EXIT PROCESS
```

---

## Hung Process Detection

```
index.js starts
  ↓
[Normal operation]
  ├─ Heartbeat: 0ms ✅
  ├─ Heartbeat: 30s ✅
  ├─ Heartbeat: 60s ✅
  ├─ Heartbeat: 90s ✅
  ├─ Heartbeat: 120s ✅
  ├─ [Process hangs - no heartbeat]
  ├─ Heartbeat: 150s ❌ (MISSING)
  ├─ Heartbeat: 180s ❌ (MISSING)
  ├─ Heartbeat: 210s ❌ (MISSING)
  ├─ [2 minutes of silence]
  ├─ Heartbeat monitor detects silence
  ├─ ⚠️ No activity for 120s
  ├─ [HEARTBEAT] Force killing child
  ↓
  restart.js kills child
  ├─ cleanupOrphanProcesses()
  ├─ Wait 5 seconds
  └─ spawn index.js again
```

---

## Memory Limit Detection

```
index.js starts
  ↓
[Normal operation]
  ├─ Memory: 100 MB ✅
  ├─ Memory: 150 MB ✅
  ├─ Memory: 200 MB ✅
  ├─ Memory: 250 MB ✅
  ├─ Memory: 300 MB ✅
  ├─ Memory: 350 MB ✅
  ├─ Memory: 400 MB ✅
  ├─ Memory: 420 MB ⚠️ (Getting close)
  ├─ Memory: 440 MB ⚠️ (Very close)
  ├─ Memory: 460 MB ❌ (EXCEEDED!)
  ├─ ❌ MEMORY LIMIT EXCEEDED
  ├─ Exit code 1
  ↓
  restart.js detects exit
  ├─ canRestart() ✅
  ├─ cleanupOrphanProcesses()
  ├─ Wait 5 seconds
  └─ spawn index.js again
```

---

## Duplicate Client Detection

```
Attempt 1: Start bot
  ├─ restart.js starts
  ├─ blockDuplicateClient() ✅
  ├─ globalClientInitialized = true
  ├─ spawn index.js
  │   ├─ Check global.__CLIENT__ ✅
  │   ├─ global.__CLIENT__ = true
  │   └─ Running...
  ↓
Attempt 2: Start bot again (mistake)
  ├─ restart.js starts
  ├─ blockDuplicateClient() ❌
  ├─ globalClientInitialized already true
  ├─ ❌ DUPLICATE CLIENT BLOCKED
  └─ EXIT
```

---

## Protection Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│ PROTECTION LAYER │ TRIGGER │ ACTION │ RECOVERY │ STATUS │       │
├─────────────────────────────────────────────────────────────────┤
│ Restart Loop    │ >10/60s │ Exit   │ Manual   │ ✅     │       │
│ Rapid Restart   │ 3<10s   │ Exit   │ Manual   │ ✅     │       │
│ Duplicate (P)   │ Flag    │ Exit   │ Manual   │ ✅     │       │
│ Duplicate (C)   │ Flag    │ Exit   │ Manual   │ ✅     │       │
│ Memory Limit    │ >450MB  │ Exit   │ Auto     │ ✅     │       │
│ Heartbeat       │ 30s     │ Log    │ N/A      │ ✅     │       │
│ Hung Process    │ 2min    │ Kill   │ Auto     │ ✅     │       │
│ Exception       │ Error   │ Exit   │ Auto     │ ✅     │       │
│ Shutdown        │ Signal  │ Close  │ N/A      │ ✅     │       │
│ Orphan Cleanup  │ Restart │ Kill   │ N/A      │ ✅     │       │
│ Lock File       │ Startup │ Kill   │ Auto     │ ✅     │       │
│ Validation      │ Init    │ Retry  │ Auto     │ ✅     │       │
│ Health Check    │ 30s     │ Refocus│ Auto     │ ✅     │       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Timeline: 24 Hours of Operation

```
Hour 0:
  ├─ Bot starts
  ├─ QR code scanned
  └─ STABLE READY ✅

Hours 1-6:
  ├─ Normal operation
  ├─ Heartbeat every 30s
  ├─ Memory stable 200-300 MB
  └─ Processing messages

Hour 7:
  ├─ Memory spike to 420 MB
  ├─ Still within limit
  └─ Continues

Hour 8:
  ├─ Memory drops to 250 MB
  ├─ Garbage collection
  └─ Normal

Hours 9-12:
  ├─ Normal operation
  ├─ Heartbeat every 30s
  ├─ Memory stable 200-300 MB
  └─ Processing messages

Hour 13:
  ├─ Crash occurs
  ├─ Uncaught exception
  ├─ Exit code 1
  └─ Parent detects

Hour 13 + 5s:
  ├─ Cleanup orphan processes
  ├─ Spawn new child
  └─ Restart attempt 1

Hour 13 + 70s:
  ├─ New instance ready
  ├─ STABLE READY ✅
  └─ Resume operation

Hours 14-24:
  ├─ Normal operation
  ├─ Heartbeat every 30s
  ├─ Memory stable 200-300 MB
  └─ Processing messages

Result:
  ├─ 1 crash detected
  ├─ 1 auto-restart
  ├─ 70 seconds downtime
  ├─ 23 hours 50 minutes uptime
  └─ 99.95% availability ✅
```

---

## Key Metrics

```
┌──────────────────────────────────────────────────────────────┐
│ METRIC                    │ VALUE      │ STATUS              │
├──────────────────────────────────────────────────────────────┤
│ Max Restarts per 60s      │ 10         │ ✅ Enforced         │
│ Rapid Restart Threshold   │ 10 seconds │ ✅ Enforced         │
│ Rapid Restart Limit       │ 3          │ ✅ Enforced         │
│ Memory Limit              │ 450 MB     │ ✅ Enforced         │
│ Heartbeat Interval        │ 30 seconds │ ✅ Active           │
│ Hung Process Timeout      │ 2 minutes  │ ✅ Enforced         │
│ Restart Delay             │ 5 seconds  │ ✅ Enforced         │
│ Health Check Interval     │ 30 seconds │ ✅ Active           │
│ Validation Retries        │ 3 attempts │ ✅ Enforced         │
│ Shutdown Timeout          │ 5 seconds  │ ✅ Enforced         │
└──────────────────────────────────────────────────────────────┘
```

---

## Conclusion

All 13 protection layers work together to:

1. **Prevent crash loops** - Restart counting + rapid detection
2. **Prevent duplicates** - Global flags + lock files
3. **Monitor health** - Heartbeat + memory + connection checks
4. **Auto-recover** - Parent process auto-restarts child
5. **Clean up** - Orphan process cleanup before restart
6. **Graceful shutdown** - Signal handlers + cleanup

**Result:** Stable 24/7 bot operation with automatic recovery from crashes.
