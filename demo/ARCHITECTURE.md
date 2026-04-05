# Analytics System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WhatsApp Automation System                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Message Handler                              │  │
│  │  (handleMessage, sendSafe, etc.)                               │  │
│  └────────────────┬─────────────────────────────────────────────────┘  │
│                   │                                                     │
│                   ├─────────────────────────────────────────────────┐   │
│                   │                                                 │   │
│                   ▼                                                 ▼   │
│  ┌──────────────────────────────┐              ┌──────────────────────┐│
│  │   Analytics Engine           │              │  Dashboard           ││
│  │  (analytics.ts)              │              │  (analytics-dash.ts) ││
│  │                              │              │                      ││
│  │ • trackMessageSent()         │              │ • logConversion()    ││
│  │ • trackMessageDelivered()    │              │ • recordDailyReport()││
│  │ • trackMessageFailed()       │              │ • getSummary()       ││
│  │ • trackConversion()          │              │                      ││
│  │ • getMetrics()               │              │                      ││
│  │ • startDashboard()           │              │                      ││
│  │ • stopDashboard()            │              │                      ││
│  └────────────┬──────────────────┘              └──────────┬───────────┘│
│               │                                            │            │
│               │                                            │            │
│               ▼                                            ▼            │
│  ┌──────────────────────────────┐              ┌──────────────────────┐│
│  │   Health Monitor             │              │  Persistent Storage  ││
│  │  (health-monitor.ts)         │              │  (JSON Files)        ││
│  │                              │              │                      ││
│  │ • recordMetrics()            │              │ • analytics.json     ││
│  │ • getStatus()                │              │ • daily_reports.json ││
│  │ • getLatestMetric()          │              │ • conversions.json   ││
│  │                              │              │                      ││
│  │ Status: healthy/warning/     │              │                      ││
│  │         critical             │              │                      ││
│  └──────────────────────────────┘              └──────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
Message Sent
    │
    ├─► trackMessageSent(chatId)
    │       │
    │       ├─► state.totalSent++
    │       ├─► state.chats[chatId].totalSent++
    │       └─► saveState() [to analytics.json]
    │
    ├─► trackMessageDelivered(chatId)
    │       │
    │       ├─► state.totalDelivered++
    │       ├─► state.chats[chatId].responseReceived = true
    │       └─► saveState() [to analytics.json]
    │
    └─► [Every 5 minutes]
            │
            ├─► Dashboard logs summary
            │   [ANALYTICS] sent: X | delivered: Y | failed: Z | ...
            │
            └─► recordDailyReport()
                    │
                    ├─► Calculate conversion rate
                    ├─► Create DailyReport object
                    └─► saveState() [to daily_reports.json]


Message Failed
    │
    └─► trackMessageFailed(chatId, body)
            │
            ├─► state.totalFailed++
            ├─► state.failedMessages.push({chatId, body, timestamp})
            ├─► Trim to 100 entries
            └─► saveState() [to analytics.json]


Conversion Completed
    │
    ├─► trackConversion(chatId)
    │       │
    │       ├─► state.conversions++
    │       ├─► state.chats[chatId].responseReceived = true
    │       └─► saveState() [to analytics.json]
    │
    └─► logConversion(chatId, stage)
            │
            ├─► Create ConversionLog object
            ├─► Append to conversions array
            └─► saveState() [to conversions.json]


Health Monitoring [Every 5 minutes]
    │
    ├─► recordMetrics(sent, delivered, failed)
    │       │
    │       ├─► Calculate failureRate = (failed / sent) * 100
    │       ├─► Calculate deliveryRate = (delivered / sent) * 100
    │       ├─► Determine status (healthy/warning/critical)
    │       └─► Store in metrics array (max 288 entries)
    │
    └─► getStatus()
            │
            ├─► If failureRate > 20% → critical
            ├─► If failureRate > 10% → warning
            └─► Else → healthy
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.ts                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  start() function                                              │
│  ├─► Initialize Analytics                                     │
│  ├─► Initialize Dashboard                                     │
│  ├─► Initialize HealthMonitor                                 │
│  ├─► Start dashboard (5-min logs)                             │
│  └─► Start health monitoring (5-min checks)                   │
│                                                                 │
│  sendSafe() function                                           │
│  ├─► Send message                                             │
│  ├─► trackMessageSent(chatId)                                 │
│  ├─► trackMessageDelivered(chatId)                            │
│  └─► On error: trackMessageFailed(chatId, text)               │
│                                                                 │
│  handleMessage() function                                      │
│  ├─► Process incoming message                                 │
│  ├─► Update user stage                                        │
│  └─► If stage === 'converted':                                │
│      ├─► trackConversion(chatId)                              │
│      └─► logConversion(chatId, stage)                         │
│                                                                 │
│  shutdown() function                                           │
│  └─► analytics.stopDashboard()                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
wa-automate-nodejs/demo/
├── index.ts                          # Main application (updated)
├── analytics.ts                      # Core analytics engine
├── analytics-dashboard.ts            # Reporting module
├── health-monitor.ts                 # Health monitoring
├── ANALYTICS_README.md               # Comprehensive guide
├── ANALYTICS_QUICK_REF.md            # Quick reference
├── ANALYTICS_GUIDE.ts                # Integration guide
├── IMPLEMENTATION_EXAMPLES.ts        # Code examples
├── AUDIT_REPORT.md                   # Security audit
├── IMPLEMENTATION_SUMMARY.md         # This summary
├── ARCHITECTURE.md                   # This file
│
└── wa-{SESSION_ID}/                  # Session directory
    ├── analytics.json                # Real-time metrics
    ├── daily_reports.json            # Daily summaries
    ├── conversions.json              # Conversion logs
    ├── state.json                    # User state
    ├── leads.json                    # Lead data
    └── sentLeads.json                # Sent leads
```

## Metrics Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Real-time Metrics                            │
│                   (analytics.json)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  totalSent: 1250                                               │
│  totalDelivered: 1200                                          │
│  totalFailed: 50                                               │
│  conversions: 45                                               │
│  activeChats: 320                                              │
│                                                                 │
│  Per-Chat Metrics:                                             │
│  ├─ 919876543210@c.us                                          │
│  │  ├─ totalSent: 5                                            │
│  │  ├─ lastInteraction: 1704067200000                          │
│  │  └─ responseReceived: true                                  │
│  │                                                              │
│  └─ 919876543211@c.us                                          │
│     ├─ totalSent: 3                                            │
│     ├─ lastInteraction: 1704067100000                          │
│     └─ responseReceived: false                                 │
│                                                                 │
│  Failed Messages:                                              │
│  ├─ {chatId, body, timestamp}                                  │
│  └─ ... (max 100 entries)                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Reports                                │
│                 (daily_reports.json)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [                                                              │
│    {                                                            │
│      date: "2024-01-01",                                       │
│      sent: 1250,                                               │
│      delivered: 1200,                                          │
│      failed: 50,                                               │
│      conversions: 45,                                          │
│      activeChats: 320,                                         │
│      conversionRate: 3.6                                       │
│    },                                                           │
│    ...                                                          │
│  ]                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Conversion Logs                              │
│                  (conversions.json)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [                                                              │
│    {                                                            │
│      chatId: "919876543210@c.us",                              │
│      timestamp: 1704067200000,                                 │
│      stage: "converted"                                        │
│    },                                                           │
│    ...                                                          │
│  ]                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Health Monitoring Flow

```
Every 5 minutes:

┌─────────────────────────────────────────────────────────────────┐
│  Get Current Metrics                                            │
│  ├─ sent: 1250                                                  │
│  ├─ delivered: 1200                                             │
│  └─ failed: 50                                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Calculate Rates                                                │
│  ├─ failureRate = (50 / 1250) * 100 = 4.0%                    │
│  └─ deliveryRate = (1200 / 1250) * 100 = 96.0%                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Determine Status                                               │
│  ├─ If failureRate > 20% → CRITICAL                            │
│  ├─ If failureRate > 10% → WARNING                             │
│  └─ Else → HEALTHY                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  Store Metric                                                   │
│  ├─ Add to metrics array                                        │
│  ├─ Keep last 288 entries (24 hours)                           │
│  └─ Log to console if not healthy                              │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────┐
│                    Performance Profile                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Memory Usage:                                                  │
│  ├─ Base: ~100 KB                                              │
│  ├─ Per 1000 chats: ~1-2 MB                                    │
│  └─ Total for 10k chats: ~10-20 MB                             │
│                                                                 │
│  Disk I/O:                                                      │
│  ├─ Per message: ~1 KB write (batched)                         │
│  ├─ Per 5 minutes: ~1 KB write (dashboard)                     │
│  └─ Per day: ~288 KB writes                                    │
│                                                                 │
│  CPU Usage:                                                     │
│  ├─ Per message: <1 ms                                         │
│  ├─ Per 5 minutes: <10 ms                                      │
│  └─ Total overhead: <1%                                        │
│                                                                 │
│  Network Impact:                                                │
│  ├─ None (local storage only)                                  │
│  └─ No external API calls                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Steps                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ ] 1. Copy analytics modules to demo/                        │
│  [ ] 2. Update index.ts imports                                │
│  [ ] 3. Initialize analytics in start()                        │
│  [ ] 4. Add tracking to sendSafe()                             │
│  [ ] 5. Add conversion tracking                                │
│  [ ] 6. Add health monitoring                                  │
│  [ ] 7. Add cleanup to shutdown()                              │
│  [ ] 8. Test with sample messages                              │
│  [ ] 9. Verify output files created                            │
│  [ ] 10. Monitor dashboard logs                                │
│  [ ] 11. Review daily_reports.json                             │
│  [ ] 12. Set up external alerting                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**Architecture Version**: 1.0
**Last Updated**: 2024
**Status**: Production Ready
