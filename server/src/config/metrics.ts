/**
 * Minimal in-memory metrics registry + Prometheus text exposition.
 *
 * Kept dependency-free: a tiny counter for total requests, per-status counts,
 * and sum/count of response durations. Exposed at GET /metrics.
 */

export const metrics = {
  requestsTotal: 0,
  byStatus: new Map<number, number>(),
  durationSumMs: 0,
  durationCount: 0,
};

export function recordRequest(status: number, durationMs: number): void {
  metrics.requestsTotal += 1;
  metrics.byStatus.set(status, (metrics.byStatus.get(status) ?? 0) + 1);
  metrics.durationSumMs += durationMs;
  metrics.durationCount += 1;
}

export function renderMetrics(): string {
  const lines: string[] = [];
  lines.push("# HELP http_requests_total Total HTTP requests processed.");
  lines.push("# TYPE http_requests_total counter");
  lines.push(`http_requests_total ${metrics.requestsTotal}`);

  lines.push("# HELP http_requests_by_status Total HTTP requests by status code.");
  lines.push("# TYPE http_requests_by_status counter");
  for (const [status, count] of [...metrics.byStatus.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    lines.push(`http_requests_by_status{status="${status}"} ${count}`);
  }

  lines.push("# HELP http_request_duration_ms_sum Sum of HTTP request durations.");
  lines.push("# TYPE http_request_duration_ms_sum counter");
  lines.push(`http_request_duration_ms_sum ${Math.round(metrics.durationSumMs)}`);

  lines.push("# HELP http_request_duration_ms_count Count of HTTP requests measured.");
  lines.push("# TYPE http_request_duration_ms_count counter");
  lines.push(`http_request_duration_ms_count ${metrics.durationCount}`);

  return lines.join("\n") + "\n";
}
