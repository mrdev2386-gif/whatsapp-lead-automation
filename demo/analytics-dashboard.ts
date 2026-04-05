import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS DASHBOARD & REPORTING
// ─────────────────────────────────────────────────────────────────────────────

interface DailyReport {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  conversions: number;
  activeChats: number;
  conversionRate: number;
}

interface ConversionLog {
  chatId: string;
  timestamp: number;
  stage: string;
}

export class AnalyticsDashboard {
  private reportsFile: string;
  private conversionsFile: string;
  private sessionId: string;

  constructor(sessionDir: string, sessionId: string) {
    this.sessionId = sessionId;
    this.reportsFile = path.join(sessionDir, 'daily_reports.json');
    this.conversionsFile = path.join(sessionDir, 'conversions.json');
  }

  logConversion(chatId: string, stage: string): void {
    try {
      let conversions: ConversionLog[] = [];
      if (fs.existsSync(this.conversionsFile)) {
        conversions = JSON.parse(fs.readFileSync(this.conversionsFile, 'utf8'));
      }
      conversions.push({
        chatId,
        timestamp: Date.now(),
        stage,
      });
      fs.writeFileSync(this.conversionsFile, JSON.stringify(conversions, null, 2), 'utf8');
    } catch (e) {
      console.error(`[DASHBOARD] Failed to log conversion:`, e);
    }
  }

  recordDailyReport(metrics: {
    sent: number;
    delivered: number;
    failed: number;
    conversions: number;
    activeChats: number;
  }): void {
    try {
      let reports: DailyReport[] = [];
      if (fs.existsSync(this.reportsFile)) {
        reports = JSON.parse(fs.readFileSync(this.reportsFile, 'utf8'));
      }

      const today = new Date().toISOString().split('T')[0];
      const existingIndex = reports.findIndex(r => r.date === today);
      const conversionRate =
        metrics.sent > 0 ? ((metrics.conversions / metrics.sent) * 100).toFixed(2) : '0';

      const report: DailyReport = {
        date: today,
        sent: metrics.sent,
        delivered: metrics.delivered,
        failed: metrics.failed,
        conversions: metrics.conversions,
        activeChats: metrics.activeChats,
        conversionRate: parseFloat(conversionRate as string),
      };

      if (existingIndex > -1) {
        reports[existingIndex] = report;
      } else {
        reports.push(report);
      }

      fs.writeFileSync(this.reportsFile, JSON.stringify(reports, null, 2), 'utf8');
    } catch (e) {
      console.error(`[DASHBOARD] Failed to record report:`, e);
    }
  }

  getConversions(): ConversionLog[] {
    try {
      if (fs.existsSync(this.conversionsFile)) {
        return JSON.parse(fs.readFileSync(this.conversionsFile, 'utf8'));
      }
    } catch (e) {
      console.error(`[DASHBOARD] Failed to read conversions:`, e);
    }
    return [];
  }

  getDailyReports(): DailyReport[] {
    try {
      if (fs.existsSync(this.reportsFile)) {
        return JSON.parse(fs.readFileSync(this.reportsFile, 'utf8'));
      }
    } catch (e) {
      console.error(`[DASHBOARD] Failed to read reports:`, e);
    }
    return [];
  }

  getSummary() {
    const reports = this.getDailyReports();
    const conversions = this.getConversions();

    if (reports.length === 0) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalConversions: 0,
        avgConversionRate: 0,
        recentConversions: [],
      };
    }

    const latest = reports[reports.length - 1];
    const avgConversionRate =
      reports.length > 0
        ? (reports.reduce((sum, r) => sum + r.conversionRate, 0) / reports.length).toFixed(2)
        : 0;

    return {
      totalSent: latest.sent,
      totalDelivered: latest.delivered,
      totalFailed: latest.failed,
      totalConversions: latest.conversions,
      avgConversionRate: parseFloat(avgConversionRate as string),
      recentConversions: conversions.slice(-10),
    };
  }
}
