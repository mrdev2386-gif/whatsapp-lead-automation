import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTWEIGHT ANALYTICS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMetrics {
  totalSent: number;
  lastInteraction: number;
  responseReceived: boolean;
}

interface AnalyticsState {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  conversions: number;
  chats: Record<string, ChatMetrics>;
  failedMessages: Array<{ chatId: string; body: string; timestamp: number }>;
  lastDashboardLog: number;
}

export class Analytics {
  private state: AnalyticsState;
  private stateFile: string;
  private sessionId: string;
  private dashboardInterval: NodeJS.Timeout | null = null;

  constructor(sessionDir: string, sessionId: string) {
    this.sessionId = sessionId;
    this.stateFile = path.join(sessionDir, 'analytics.json');
    this.state = this.loadState();
  }

  private loadState(): AnalyticsState {
    if (fs.existsSync(this.stateFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      } catch (e) {
        console.error(`[ANALYTICS] Failed to load state:`, e);
      }
    }
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      conversions: 0,
      chats: {},
      failedMessages: [],
      lastDashboardLog: Date.now(),
    };
  }

  private saveState(): void {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error(`[ANALYTICS] Failed to save state:`, e);
    }
  }

  trackMessageSent(chatId: string): void {
    this.state.totalSent += 1;
    this.initChatMetrics(chatId);
    this.state.chats[chatId].totalSent += 1;
    this.state.chats[chatId].lastInteraction = Date.now();
    this.saveState();
  }

  trackMessageDelivered(chatId: string): void {
    this.state.totalDelivered += 1;
    this.initChatMetrics(chatId);
    this.state.chats[chatId].responseReceived = true;
    this.saveState();
  }

  trackMessageFailed(chatId: string, body: string): void {
    this.state.totalFailed += 1;
    this.initChatMetrics(chatId);
    this.state.failedMessages.push({
      chatId,
      body: body.substring(0, 100),
      timestamp: Date.now(),
    });
    if (this.state.failedMessages.length > 100) {
      this.state.failedMessages.shift();
    }
    this.saveState();
  }

  trackConversion(chatId: string): void {
    this.state.conversions += 1;
    this.initChatMetrics(chatId);
    this.state.chats[chatId].responseReceived = true;
    this.saveState();
  }

  private initChatMetrics(chatId: string): void {
    if (!this.state.chats[chatId]) {
      this.state.chats[chatId] = {
        totalSent: 0,
        lastInteraction: Date.now(),
        responseReceived: false,
      };
    }
  }

  getMetrics() {
    return {
      sent: this.state.totalSent,
      delivered: this.state.totalDelivered,
      failed: this.state.totalFailed,
      conversions: this.state.conversions,
      activeChats: Object.keys(this.state.chats).length,
      failedCount: this.state.failedMessages.length,
    };
  }

  startDashboard(): void {
    if (this.dashboardInterval) return;

    this.dashboardInterval = setInterval(() => {
      const metrics = this.getMetrics();
      const now = Date.now();
      const timeSinceLastLog = (now - this.state.lastDashboardLog) / 1000 / 60;

      if (timeSinceLastLog >= 5) {
        console.log(
          `\n[ANALYTICS] ` +
          `sent: ${metrics.sent} | ` +
          `delivered: ${metrics.delivered} | ` +
          `failed: ${metrics.failed} | ` +
          `active chats: ${metrics.activeChats} | ` +
          `conversions: ${metrics.conversions}\n`
        );
        this.state.lastDashboardLog = now;
        this.saveState();
      }
    }, 60000);
  }

  stopDashboard(): void {
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
    }
  }

  getFailedMessages() {
    return this.state.failedMessages;
  }

  getChatMetrics(chatId: string) {
    return this.state.chats[chatId] || null;
  }
}
