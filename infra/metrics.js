function escapeHelp(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabel(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function clampNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function formatNumber(value) {
  const normalized = clampNumber(value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }

  return normalized.toString();
}

class BaseMetric {
  constructor({ name, help, type, labelNames = [] }) {
    this.name = name;
    this.help = help;
    this.type = type;
    this.labelNames = labelNames;
    this.samples = new Map();
  }

  labelsToKey(labels = {}) {
    return this.labelNames.map((name) => String(labels[name] ?? "")).join("\x1f");
  }

  labelsToObject(labels = {}) {
    const normalized = {};
    this.labelNames.forEach((name) => {
      normalized[name] = String(labels[name] ?? "");
    });

    return normalized;
  }

  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return "";
    }

    const pairs = Object.entries(labels)
      .map(([name, value]) => `${name}="${escapeLabel(value)}"`)
      .join(",");
    return `{${pairs}}`;
  }

  renderHeader() {
    return [`# HELP ${this.name} ${escapeHelp(this.help)}`, `# TYPE ${this.name} ${this.type}`];
  }
}

class CounterMetric extends BaseMetric {
  constructor(args) {
    super({ ...args, type: "counter" });
  }

  inc(labels = {}, value = 1) {
    const key = this.labelsToKey(labels);
    const existing = this.samples.get(key);
    const normalizedLabels = existing?.labels ?? this.labelsToObject(labels);
    const currentValue = existing?.value ?? 0;
    this.samples.set(key, {
      labels: normalizedLabels,
      value: currentValue + clampNumber(value),
    });
  }

  renderLines() {
    const lines = this.renderHeader();
    if (this.samples.size === 0) {
      lines.push(`${this.name} 0`);
      return lines;
    }

    for (const sample of this.samples.values()) {
      lines.push(
        `${this.name}${this.formatLabels(sample.labels)} ${formatNumber(sample.value)}`,
      );
    }

    return lines;
  }
}

class GaugeMetric extends BaseMetric {
  constructor(args) {
    super({ ...args, type: "gauge" });
  }

  set(labels = {}, value = 0) {
    const key = this.labelsToKey(labels);
    const existing = this.samples.get(key);
    const normalizedLabels = existing?.labels ?? this.labelsToObject(labels);
    this.samples.set(key, {
      labels: normalizedLabels,
      value: clampNumber(value),
    });
  }

  inc(labels = {}, value = 1) {
    const key = this.labelsToKey(labels);
    const existing = this.samples.get(key);
    const normalizedLabels = existing?.labels ?? this.labelsToObject(labels);
    const currentValue = existing?.value ?? 0;
    this.samples.set(key, {
      labels: normalizedLabels,
      value: currentValue + clampNumber(value),
    });
  }

  dec(labels = {}, value = 1) {
    this.inc(labels, -clampNumber(value));
  }

  renderLines() {
    const lines = this.renderHeader();
    if (this.samples.size === 0) {
      lines.push(`${this.name} 0`);
      return lines;
    }

    for (const sample of this.samples.values()) {
      lines.push(
        `${this.name}${this.formatLabels(sample.labels)} ${formatNumber(sample.value)}`,
      );
    }

    return lines;
  }
}

class HistogramMetric extends BaseMetric {
  constructor({ buckets, ...args }) {
    super({ ...args, type: "histogram" });
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(labels = {}, value = 0) {
    const key = this.labelsToKey(labels);
    const existing = this.samples.get(key);
    const normalizedLabels = existing?.labels ?? this.labelsToObject(labels);
    const numeric = clampNumber(value);

    const sample =
      existing ??
      {
        labels: normalizedLabels,
        bucketCounts: new Array(this.buckets.length + 1).fill(0),
        count: 0,
        sum: 0,
      };

    this.buckets.forEach((bucket, index) => {
      if (numeric <= bucket) {
        sample.bucketCounts[index] += 1;
      }
    });
    sample.bucketCounts[this.buckets.length] += 1;
    sample.count += 1;
    sample.sum += numeric;

    this.samples.set(key, sample);
  }

  renderLines() {
    const lines = this.renderHeader();
    if (this.samples.size === 0) {
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines;
    }

    for (const sample of this.samples.values()) {
      this.buckets.forEach((bucket, index) => {
        const labels = {
          ...sample.labels,
          le: bucket,
        };
        lines.push(
          `${this.name}_bucket${this.formatLabels(labels)} ${formatNumber(
            sample.bucketCounts[index],
          )}`,
        );
      });

      lines.push(
        `${this.name}_bucket${this.formatLabels({
          ...sample.labels,
          le: "+Inf",
        })} ${formatNumber(sample.bucketCounts[this.buckets.length])}`,
      );
      lines.push(
        `${this.name}_sum${this.formatLabels(sample.labels)} ${formatNumber(sample.sum)}`,
      );
      lines.push(
        `${this.name}_count${this.formatLabels(sample.labels)} ${formatNumber(sample.count)}`,
      );
    }

    return lines;
  }
}

export class MetricsRegistry {
  constructor() {
    this.metrics = new Map();
  }

  registerCounter({ name, help, labelNames = [] }) {
    const metric = new CounterMetric({ name, help, labelNames });
    this.metrics.set(name, metric);
    return metric;
  }

  registerGauge({ name, help, labelNames = [] }) {
    const metric = new GaugeMetric({ name, help, labelNames });
    this.metrics.set(name, metric);
    return metric;
  }

  registerHistogram({
    name,
    help,
    labelNames = [],
    buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  }) {
    const metric = new HistogramMetric({ name, help, labelNames, buckets });
    this.metrics.set(name, metric);
    return metric;
  }

  toPrometheus() {
    const lines = [];
    for (const metric of this.metrics.values()) {
      lines.push(...metric.renderLines(), "");
    }

    return `${lines.join("\n").trimEnd()}\n`;
  }
}

export function createAppMetrics({ prefix = "valik" } = {}) {
  const registry = new MetricsRegistry();

  const httpRequestsTotal = registry.registerCounter({
    name: `${prefix}_http_requests_total`,
    help: "Total HTTP requests by method, route and status.",
    labelNames: ["method", "route", "status"],
  });

  const httpRequestDuration = registry.registerHistogram({
    name: `${prefix}_http_request_duration_seconds`,
    help: "HTTP request latency in seconds by method, route and status.",
    labelNames: ["method", "route", "status"],
  });

  const crmOutboxJobsTotal = registry.registerCounter({
    name: `${prefix}_crm_outbox_jobs_total`,
    help: "CRM outbox jobs lifecycle counters.",
    labelNames: ["result"],
  });

  const crmOutboxProcessRunsTotal = registry.registerCounter({
    name: `${prefix}_crm_outbox_process_runs_total`,
    help: "CRM outbox process loop run counts.",
    labelNames: ["result"],
  });

  const crmOutboxProcessDuration = registry.registerHistogram({
    name: `${prefix}_crm_outbox_process_duration_seconds`,
    help: "Duration of CRM outbox batch processing in seconds.",
    labelNames: ["result"],
  });

  const crmOutboxDlqTotal = registry.registerCounter({
    name: `${prefix}_crm_outbox_dlq_total`,
    help: "CRM outbox dead-letter events.",
    labelNames: ["reason"],
  });

  return {
    registry,
    httpRequestsTotal,
    httpRequestDuration,
    crmOutboxJobsTotal,
    crmOutboxProcessRunsTotal,
    crmOutboxProcessDuration,
    crmOutboxDlqTotal,
  };
}
