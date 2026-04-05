# 🔧 BROWSER LAUNCH FIX - QUICK REFERENCE

## ONE-COMMAND FIX

```bash
cleanup-browser-fix.bat
start-browser-fix.bat 918073539824
```

## WHAT WAS FIXED

| Issue | Fix |
|-------|-----|
| --single-process crash | ❌ REMOVED |
| --no-zygote incompatible | ❌ REMOVED |
| Chrome not found | ✅ Added system path |
| Memory pressure | ✅ Added --max-old-space-size=512 |
| Corrupted cache | ✅ Reinstall puppeteer@19 |

---

## KEY CHANGES

### Removed Flags
```typescript
// ❌ REMOVED (cause browser crash on Windows)
'--single-process',
'--no-zygote'
```

### Added System Chrome Path
```typescript
// ✅ ADDED (force system Chrome)
executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

### Memory Limit
```bash
# ✅ ADDED (prevent memory pressure)
node --max-old-space-size=512 demo/index.js --session=YOUR_NUMBER
```

---

## STARTUP COMMAND

**Old (Broken):**
```bash
node demo/index.js --session=918073539824
```

**New (Fixed):**
```bash
node --max-old-space-size=512 demo/index.js --session=918073539824
```

---

## CRITICAL RULES

✅ **DO:**
- Remove --single-process
- Remove --no-zygote
- Use system Chrome path
- Use --max-old-space-size=512
- Run cleanup before startup

❌ **DON'T:**
- Use --single-process on Windows
- Use --no-zygote
- Run without memory limit
- Skip cleanup step

---

## EXPECTED OUTPUT

```
[SESSION 918073539824] STABLE READY ✅
Waiting for messages...
```

---

## TROUBLESHOOTING

| Error | Fix |
|-------|-----|
| Failed to launch browser | Run cleanup-browser-fix.bat |
| Puppeteer not found | npm install puppeteer@19 --save-exact |
| Out of memory | Increase --max-old-space-size to 1024 |
| Chrome path not found | Verify Chrome installation path |

---

## FILES

- `cleanup-browser-fix.bat` - Cleanup & reinstall
- `start-browser-fix.bat` - Startup with memory limit
- `BROWSER_FIX_GUIDE.md` - Full guide

---

**Status:** ✅ Production Ready
**Version:** Browser Fix v1.0
