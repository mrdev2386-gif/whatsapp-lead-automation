# 🚀 QUICK ACTION GUIDE - RUN NOW

## ✅ CONFIGURATION VERIFIED

The `executablePath` is **correctly configured** in `demo/index.ts`:

```typescript
executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

**No code changes needed. Ready to run!**

---

## STEP-BY-STEP EXECUTION

### Step 1: Kill Chrome Processes
```bash
taskkill /F /IM chrome.exe /T
```

### Step 2: Run Bot with Memory Limit
```bash
node --max-old-space-size=512 demo/index.js --session=918073539824
```

Replace `918073539824` with your phone number.

### Step 3: Wait for QR Code
Terminal will show:
```
[QR 918073539824] Saved → wa-918073539824/qr_code.png (scan with your phone)
```

### Step 4: Scan QR Code
- Open WhatsApp on your phone
- Scan the QR code
- **DO NOT touch keyboard/mouse**
- **DO NOT switch windows**
- **WAIT 60-90 seconds**

### Step 5: Validate Success
Look for:
```
[SESSION 918073539824] STABLE READY ✅
Waiting for messages...
```

---

## WHAT'S CONFIGURED

✅ **executablePath:** System Chrome path
✅ **headless:** true (minimal UI)
✅ **authTimeout:** 60 seconds
✅ **args:** Optimized for low-RAM
✅ **Memory limit:** 512MB

---

## EXPECTED TIMELINE

| Phase | Duration | Status |
|-------|----------|--------|
| Browser launch | 20-30s | ⏳ |
| Session hardening | 60s | ⏳ |
| QR scan | 30-60s | ⏳ |
| Total startup | 60-90s | ✅ |

---

## TROUBLESHOOTING

### "Failed to launch browser"
```bash
# Verify Chrome is installed
dir "C:\Program Files\Google\Chrome\Application\chrome.exe"

# If not found, check alternative path
dir "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
```

### "Out of memory"
```bash
# Increase memory limit
node --max-old-space-size=1024 demo/index.js --session=918073539824
```

### "Port already in use"
```bash
# Kill all Node processes
taskkill /F /IM node.exe /T
```

---

## FINAL CHECKLIST

- [ ] Chrome is installed
- [ ] Ran: `taskkill /F /IM chrome.exe /T`
- [ ] Running: `node --max-old-space-size=512 demo/index.js --session=YOUR_NUMBER`
- [ ] QR code appeared
- [ ] Scanned QR code
- [ ] Waited 60-90 seconds
- [ ] See "STABLE READY ✅"

---

## SUCCESS INDICATORS

✅ No "Failed to launch browser" error
✅ QR code appears in terminal
✅ Session initializes successfully
✅ "STABLE READY ✅" message appears
✅ Bot responds to "hi" with "Working ✅"

---

**Status:** Ready to Deploy
**Configuration:** Complete & Verified
**Next Action:** Run the command above
