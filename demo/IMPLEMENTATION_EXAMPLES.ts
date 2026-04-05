// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS IMPLEMENTATION EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EXAMPLE 1: Initialize Analytics in start() function
 * 
 * Location: In the start() function after client validation
 */
export const EXAMPLE_1_INIT = `
async function start(client: Client): Promise<void> {
  const sid = \`[SESSION \${SESSION_ID}]\`;
  console.log(\`\${sid} Client started, wait for readiness signal...\`);
  
  // Initialize analytics
  analytics = new Analytics(SESSION_DIR, SESSION_ID);
  dashboard = new AnalyticsDashboard(SESSION_DIR, SESSION_ID);
  healthMonitor = new HealthMonitor(SESSION_ID);
  
  analytics.startDashboard();
  console.log(\`\${sid} Analytics initialized\`);
  
  // ... rest of start function
}
`;

/**
 * EXAMPLE 2: Track Message Sent in sendSafe() function
 * 
 * Location: In the sendSafe() function after client.sendText()
 */
export const EXAMPLE_2_TRACK_SENT = `
async function sendSafe(
  client: Client,
  chatId: string,
  user: UserState,
  text: string
): Promise<void> {
  const sid = \`[SESSION \${SESSION_ID}]\`;
  
  // ... existing code ...
  
  try {
    await client.sendText(chatId as ChatId, text);
    console.log(\`\${sid} [REPLY] Sent to \${chatId}\`);
    
    // Track message sent
    analytics.trackMessageSent(chatId);
    analytics.trackMessageDelivered(chatId);
    
  } catch (err: any) {
    console.error(\`\${sid} [REPLY] Failed to send:\`, err.message);
    
    // Track message failed
    analytics.trackMessageFailed(chatId, text);
  }
  
  // ... rest of function
}
`;

/**
 * EXAMPLE 3: Track Conversion in handleMessage()
 * 
 * Location: When user.stage changes to 'converted'
 */
export const EXAMPLE_3_TRACK_CONVERSION = `
// In handleMessage() function, when confirming conversion
if (/(^ha$|^yes$|^ok$)/i.test(body.toLowerCase())) {
  if (user.stage === 'confirm_start') {
    await client.sendText(chatId as ChatId, msg.closed);
    user.stage = 'converted';
    user.status = 'DEAD';
    
    // Track conversion
    analytics.trackConversion(chatId);
    dashboard.logConversion(chatId, 'converted');
    
    console.log(\`\${sid} [STAGE] \${chatId} converted!\`);
    saveLead(chatId, body, user, name);
    saveState();
    return;
  }
}
`;

/**
 * EXAMPLE 4: Health Monitoring in start() function
 * 
 * Location: In the start() function after client setup
 */
export const EXAMPLE_4_HEALTH_MONITORING = `
// In start() function, after client setup
setInterval(() => {
  try {
    const metrics = analytics.getMetrics();
    healthMonitor.recordMetrics(metrics.sent, metrics.delivered, metrics.failed);
    
    const status = healthMonitor.getStatus();
    if (status === 'critical') {
      console.error(\`[ALERT] System health CRITICAL!\`);
      // Could send alert to admin here
    } else if (status === 'warning') {
      console.warn(\`[ALERT] System health WARNING\`);
    }
  } catch (e) {
    console.error('[HEALTH] Error recording metrics:', e);
  }
}, 5 * 60 * 1000); // Every 5 minutes
`;

/**
 * EXAMPLE 5: Cleanup in shutdown() function
 * 
 * Location: In the shutdown() function
 */
export const EXAMPLE_5_SHUTDOWN = `
async function shutdown(signal: string) {
  const sid = \`[SESSION \${SESSION_ID}]\`;
  console.log(\`\\n\${sid} [\${signal}] Shutting down...\`);
  
  // Stop analytics
  if (analytics) {
    analytics.stopDashboard();
    console.log(\`\${sid} [SHUTDOWN] Analytics stopped.\`);
  }
  
  // ... rest of shutdown
}
`;

/**
 * EXAMPLE 6: Get Analytics Summary
 * 
 * Usage: Call this to get current metrics
 */
export const EXAMPLE_6_GET_SUMMARY = `
// Get current metrics
const metrics = analytics.getMetrics();
console.log(\`
  Sent: \${metrics.sent}
  Delivered: \${metrics.delivered}
  Failed: \${metrics.failed}
  Active Chats: \${metrics.activeChats}
  Conversions: \${metrics.conversions}
\`);

// Get dashboard summary
const summary = dashboard.getSummary();
console.log(\`
  Total Sent: \${summary.totalSent}
  Total Delivered: \${summary.totalDelivered}
  Total Failed: \${summary.totalFailed}
  Total Conversions: \${summary.totalConversions}
  Avg Conversion Rate: \${summary.avgConversionRate}%
  Recent Conversions: \${summary.recentConversions.length}
\`);

// Get health status
const status = healthMonitor.getStatus();
console.log(\`System Health: \${status}\`);
`;

/**
 * EXAMPLE 7: Query Failed Messages
 * 
 * Usage: Debug failed messages
 */
export const EXAMPLE_7_FAILED_MESSAGES = `
// Get failed messages for debugging
const failedMessages = analytics.getFailedMessages();
console.log(\`Failed Messages (\${failedMessages.length}):\`);
failedMessages.forEach(msg => {
  console.log(\`
    Chat: \${msg.chatId}
    Body: \${msg.body}
    Time: \${new Date(msg.timestamp).toISOString()}
  \`);
});
`;

/**
 * EXAMPLE 8: Query Conversions
 * 
 * Usage: Analyze conversion patterns
 */
export const EXAMPLE_8_CONVERSIONS = `
// Get all conversions
const conversions = dashboard.getConversions();
console.log(\`Total Conversions: \${conversions.length}\`);

// Group by date
const byDate: Record<string, number> = {};
conversions.forEach(conv => {
  const date = new Date(conv.timestamp).toISOString().split('T')[0];
  byDate[date] = (byDate[date] || 0) + 1;
});

console.log('Conversions by Date:', byDate);
`;

/**
 * EXAMPLE 9: Query Daily Reports
 * 
 * Usage: Analyze daily performance
 */
export const EXAMPLE_9_DAILY_REPORTS = `
// Get daily reports
const reports = dashboard.getDailyReports();
console.log(\`Daily Reports (\${reports.length} days):\`);

reports.forEach(report => {
  console.log(\`
    Date: \${report.date}
    Sent: \${report.sent}
    Delivered: \${report.delivered}
    Failed: \${report.failed}
    Conversions: \${report.conversions}
    Active Chats: \${report.activeChats}
    Conversion Rate: \${report.conversionRate}%
  \`);
});
`;

/**
 * EXAMPLE 10: Export Analytics Data
 * 
 * Usage: Export for external analysis
 */
export const EXAMPLE_10_EXPORT = `
// Export analytics data
function exportAnalytics() {
  const metrics = analytics.getMetrics();
  const summary = dashboard.getSummary();
  const reports = dashboard.getDailyReports();
  const conversions = dashboard.getConversions();
  
  const exportData = {
    exportDate: new Date().toISOString(),
    currentMetrics: metrics,
    summary: summary,
    dailyReports: reports,
    conversions: conversions,
    healthStatus: healthMonitor.getStatus(),
    latestHealth: healthMonitor.getLatestMetric()
  };
  
  fs.writeFileSync(
    'analytics_export.json',
    JSON.stringify(exportData, null, 2)
  );
  
  console.log('Analytics exported to analytics_export.json');
}
`;

/**
 * COMPLETE INTEGRATION CHECKLIST
 */
export const INTEGRATION_CHECKLIST = `
ANALYTICS INTEGRATION CHECKLIST
================================

[ ] 1. Import analytics modules at top of index.ts
    import { Analytics } from './analytics';
    import { AnalyticsDashboard } from './analytics-dashboard';
    import { HealthMonitor } from './health-monitor';

[ ] 2. Declare global variables
    let analytics: Analytics;
    let dashboard: AnalyticsDashboard;
    let healthMonitor: HealthMonitor;

[ ] 3. Initialize in start() function
    analytics = new Analytics(SESSION_DIR, SESSION_ID);
    dashboard = new AnalyticsDashboard(SESSION_DIR, SESSION_ID);
    healthMonitor = new HealthMonitor(SESSION_ID);
    analytics.startDashboard();

[ ] 4. Add tracking to sendSafe() function
    try {
      await client.sendText(chatId, text);
      analytics.trackMessageSent(chatId);
      analytics.trackMessageDelivered(chatId);
    } catch (err) {
      analytics.trackMessageFailed(chatId, text);
    }

[ ] 5. Add conversion tracking in handleMessage()
    if (user.stage === 'converted') {
      analytics.trackConversion(chatId);
      dashboard.logConversion(chatId, 'converted');
    }

[ ] 6. Add health monitoring in start()
    setInterval(() => {
      const metrics = analytics.getMetrics();
      healthMonitor.recordMetrics(metrics.sent, metrics.delivered, metrics.failed);
    }, 5 * 60 * 1000);

[ ] 7. Add cleanup in shutdown()
    if (analytics) {
      analytics.stopDashboard();
    }

[ ] 8. Test with sample messages
    - Send test message
    - Verify analytics.json created
    - Check dashboard logs every 5 minutes

[ ] 9. Verify output files
    - analytics.json (real-time metrics)
    - daily_reports.json (daily summaries)
    - conversions.json (conversion logs)

[ ] 10. Monitor health status
     - Check console for [ANALYTICS] logs
     - Review health status for warnings/critical
     - Monitor failure rates

VERIFICATION
============

After integration, verify:
1. Analytics files created in SESSION_DIR
2. Dashboard logs appear every 5 minutes
3. Metrics increase as messages are sent
4. Conversions logged when stage changes
5. Failed messages tracked on errors
6. Health status updates every 5 minutes
7. No performance degradation
8. No memory leaks

TROUBLESHOOTING
===============

Issue: No analytics.json file created
- Check SESSION_DIR exists and is writable
- Verify analytics.startDashboard() called
- Check console for error messages

Issue: Dashboard not logging
- Verify 5 minutes have passed
- Check messages are being sent
- Verify analytics.startDashboard() called

Issue: High memory usage
- Check failed message count
- Archive old conversion logs
- Monitor chat count growth

Issue: High failure rate
- Check network connectivity
- Review failed_messages in analytics.json
- Check WhatsApp API status
`;

/**
 * QUICK COPY-PASTE SNIPPETS
 */
export const SNIPPETS = {
  IMPORT: `import { Analytics } from './analytics';
import { AnalyticsDashboard } from './analytics-dashboard';
import { HealthMonitor } from './health-monitor';`,

  DECLARE: `let analytics: Analytics;
let dashboard: AnalyticsDashboard;
let healthMonitor: HealthMonitor;`,

  INIT: `analytics = new Analytics(SESSION_DIR, SESSION_ID);
dashboard = new AnalyticsDashboard(SESSION_DIR, SESSION_ID);
healthMonitor = new HealthMonitor(SESSION_ID);
analytics.startDashboard();`,

  TRACK_SENT: `analytics.trackMessageSent(chatId);
analytics.trackMessageDelivered(chatId);`,

  TRACK_FAILED: `analytics.trackMessageFailed(chatId, text);`,

  TRACK_CONVERSION: `analytics.trackConversion(chatId);
dashboard.logConversion(chatId, 'converted');`,

  HEALTH_CHECK: `const metrics = analytics.getMetrics();
healthMonitor.recordMetrics(metrics.sent, metrics.delivered, metrics.failed);`,

  CLEANUP: `if (analytics) {
  analytics.stopDashboard();
}`
};
