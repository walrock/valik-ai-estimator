import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHttpApp } from "../server/app.js";
import { SessionRepository } from "../storage/repository.js";
import { createStaticExtractor } from "../services/extractor.js";
import { createChatAgent } from "../services/chat-agent.js";
import { createLogger } from "../infra/logger.js";
import { createAppMetrics } from "../infra/metrics.js";

function parseJsonLogs(lines) {
  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function buildObservabilityApp() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "valik-observability-test-"));
  const repository = new SessionRepository({
    dbPath: path.join(tempRoot, "app.sqlite"),
  });
  await repository.init();

  const extractWorks = createStaticExtractor(() => ({ works: [] }));
  const agent = createChatAgent({ extractWorks });
  const crmClient = {
    async sendLead() {
      return { sent: false, mode: "stub" };
    },
  };

  const logLines = [];
  const logger = createLogger({
    service: "valik-observability-test",
    level: "debug",
    sink: {
      write(chunk) {
        String(chunk)
          .split(/\r?\n/)
          .filter((line) => line.length > 0)
          .forEach((line) => logLines.push(line));
      },
    },
  });
  const metrics = createAppMetrics({ prefix: "valik" });

  const app = createHttpApp({
    repository,
    agent,
    crmClient,
    logger,
    metrics,
    security: {
      rateLimitMaxRequests: 1000,
      spamMinIntervalMs: 1,
    },
  });
  const port = await app.start(0);

  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    logLines,
    cleanup: async () => {
      await app.stop();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

test("observability: metrics endpoint exposes HTTP counters and histograms", async () => {
  const runtime = await buildObservabilityApp();

  try {
    const healthResponse = await fetch(`${runtime.baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.ok(healthResponse.headers.get("x-request-id"));

    const metricsResponse = await fetch(`${runtime.baseUrl}/metrics`);
    assert.equal(metricsResponse.status, 200);
    assert.match(metricsResponse.headers.get("content-type"), /text\/plain/);

    const body = await metricsResponse.text();
    assert.ok(body.includes("valik_http_requests_total"));
    assert.ok(body.includes("valik_http_request_duration_seconds"));
    assert.ok(
      body.includes('valik_http_requests_total{method="GET",route="/health",status="200"}'),
    );
  } finally {
    await runtime.cleanup();
  }
});

test("observability: request logs include request_id and route", async () => {
  const runtime = await buildObservabilityApp();

  try {
    const requestId = "test-request-123";
    const response = await fetch(`${runtime.baseUrl}/health`, {
      headers: {
        "X-Request-Id": requestId,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), requestId);

    const logs = parseJsonLogs(runtime.logLines);
    const httpEntry = logs.find(
      (entry) =>
        entry.event === "http_request" &&
        entry.pathname === "/health" &&
        entry.request_id === requestId,
    );

    assert.ok(httpEntry);
    assert.equal(httpEntry.status_code, 200);
    assert.equal(httpEntry.route, "/health");
  } finally {
    await runtime.cleanup();
  }
});
