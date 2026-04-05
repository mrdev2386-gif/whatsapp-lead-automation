// ─────────────────────────────────────────────────────────────────────────────
// MONITORING & ALERTING
// ─────────────────────────────────────────────────────────────────────────────

interface HealthMetrics {
  timestamp: number;
  sent: number;
  delivered: number;
  failed: number;
  failureRate: number;
  deliveryRate: number;
  status: 'healthy' | 'warning' | 'critical';
}

export class HealthMonitor {
  private metrics: HealthMetrics[] = [];
  private maxMetrics = 288; // 24 hours at 5-min intervals
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  recordMetrics(sent: number, delivered: number, failed: number): void {
    const failureRate = sent > 0 ? (failed / sent) * 100 : 0;
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (failureRate > 20) status = 'critical';
    else if (failureRate > 10) status = 'warning';

    const metric: HealthMetrics = {
      timestamp: Date.now(),
      sent,
      delivered,
      failed,
      failureRate,
      deliveryRate,
      status,
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    if (status !== 'healthy') {
      console.warn(
        `[HEALTH] ${status.toUpperCase()}: Failure rate ${failureRate.toFixed(2)}% | Delivery rate ${deliveryRate.toFixed(2)}%`
      );
    }
  }

  getStatus(): 'healthy' | 'warning' | 'critical' {
    if (this.metrics.length === 0) return 'healthy';
    const recent = this.metrics.slice(-12); // Last hour
    const avgFailureRate =
      recent.reduce((sum, m) => sum + m.failureRate, 0) / recent.length;

    if (avgFailureRate > 20) return 'critical';
    if (avgFailureRate > 10) return 'warning';
    return 'healthy';
  }

  getMetrics(): HealthMetrics[] {
    return this.metrics;
  }

  getLatestMetric(): HealthMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
}
