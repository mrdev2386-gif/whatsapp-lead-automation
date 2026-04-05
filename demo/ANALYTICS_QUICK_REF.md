# Analytics Quick Reference

## One-Minute Setup

```typescript
// 1. Import
import { Analytics } from './analytics';
import { AnalyticsDashboard } from './analytics-dashboard';
import { HealthMonitor } from './health-monitor';

// 2. Initialize (in start() function)
const analytics = new Analytics(SESSION_DIR, SESSION_ID);
const dashboard = new AnalyticsDashboard(SESSION_DIR, SESSION_ID);
const healthMonitor = new HealthMonitor(SESSION_ID);
analytics.startDashboard();

// 3. Track sends (in sendSafe function)
try {
  await client.sendText(chatId, text);
  analytics.trackMessageSent(chatId);
  analytics.trackMessageDelivered(chatId);
} catch (err) {
  analytics.trackMessageFailed(chatId, text);
}

// 4. Track conversions (in handleMessage function)
if (user.stage === 'converted') {
  analytics.trackConversion(chatId);
  dashboard.logConversion(chatId, 'converted');
}

// 5. Health monitoring (in start function)
setInterval(() => {
  const metrics = analytics.getMetrics();
  healthMonitor.recordMetrics(metrics.sent, metrics.delivered, metrics.failed);
}, 5 * 60 * 1000);

// 6. Cleanup (in shutdown function)
analytics.stopDashboard();
```

## Key Methods

### Analytics
```typescript
analytics.trackMessageSent(chatId)           // Call after send
analytics.trackMessageDelivered(chatId)      // Call on ACK
analytics.trackMessageFailed(chatId, body)   // Call on error
analytics.trackConversion(chatId)            // Call on conversion
analytics.getMetrics()                       // Get current metrics
analytics.startDashboard()                   // Start 5-min logging
analytics.stopDashboard()                    // Stop logging
```

### AnalyticsDashboard
```typescript
dashboard.logConversion(chatId, stage)       // Log conversion
dashboard.recordDailyReport(metrics)         // Record daily summary
dashboard.getConversions()                   // Get all conversions
dashboard.getDailyReports()                  // Get all daily reports
dashboard.getSummary()                       // Get summary stats
```

### HealthMonitor
```typescript
healthMonitor.recordMetrics(sent, delivered, failed)  // Record metrics
healthMonitor.getStatus()                            // Get health status
healthMonitor.getLatestMetric()                       // Get latest metric
```

## Output Files

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `analytics.json` | Real-time metrics | On each action |
| `daily_reports.json` | Daily summaries | Daily |
| `conversions.json` | Conversion logs | On conversion |

## Dashboard Output

Every 5 minutes:
```
[ANALYTICS] sent: 1250 | delivered: 1200 | failed: 50 | active chats: 320 | conversions: 45
```

## Health Status

- **healthy**: Failure rate < 10%
- **warning**: Failure rate 10-20%
- **critical**: Failure rate > 20%

## Common Patterns

### Track message with error handling
```typescript
try {
  await client.sendText(chatId, text);
  analytics.trackMessageSent(chatId);
  analytics.trackMessageDelivered(chatId);
} catch (err) {
  analytics.trackMessageFailed(chatId, text);
  throw err;
}
```

### Track conversion
```typescript
if (user.stage === 'converted') {
  analytics.trackConversion(chatId);
  dashboard.logConversion(chatId, user.stage);
}
```

### Get metrics for reporting
```typescript
const metrics = analytics.getMetrics();
console.log(`Sent: ${metrics.sent}, Delivered: ${metrics.delivered}, Failed: ${metrics.failed}`);
```

### Check system health
```typescript
const status = healthMonitor.getStatus();
if (status === 'critical') {
  // Alert or take action
}
```

## Integration Checklist

- [ ] Import analytics modules
- [ ] Initialize in start() function
- [ ] Add tracking to sendSafe() function
- [ ] Add conversion tracking to handleMessage()
- [ ] Add health monitoring interval
- [ ] Add cleanup to shutdown() function
- [ ] Test with sample messages
- [ ] Verify output files are created
- [ ] Check dashboard logs every 5 minutes
- [ ] Monitor health status

## Troubleshooting

**No output files created?**
- Check SESSION_DIR exists
- Verify write permissions
- Check console for errors

**Dashboard not logging?**
- Verify analytics.startDashboard() called
- Check 5-minute interval has passed
- Verify messages are being sent

**High failure rate?**
- Check network connectivity
- Review failed_messages in analytics.json
- Check WhatsApp API status

**Memory usage high?**
- Reduce MAX_FAILED_MESSAGES
- Archive old conversion logs
- Check chat count growth

## Performance Tips

1. Use batched writes (already implemented)
2. Limit failed message retention (100 entries)
3. Archive old reports monthly
4. Monitor memory usage
5. Use health monitoring for early detection

## Next Steps

1. Review ANALYTICS_README.md for detailed documentation
2. Check ANALYTICS_GUIDE.ts for integration examples
3. Monitor daily_reports.json for business metrics
4. Set up external alerting based on health status
5. Archive old logs monthly
