import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHttpApp } from "../server/app.js";
import { SessionRepository } from "../storage/repository.js";
import { OutboxRepository } from "../storage/outbox-repository.js";
import { createStaticExtractor } from "../services/extractor.js";
import { createChatAgent } from "../services/chat-agent.js";
import { CrmOutboxProcessor } from "../services/outbox-processor.js";
import { runStagingSmoke } from "../infra/staging-smoke.js";
import { createAppMetrics } from "../infra/metrics.js";

async function buildRuntime({ security = {} } = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "valik-smoke-test-"));
  const repository = new SessionRepository({
    dbPath: path.join(tempRoot, "app.sqlite"),
  });
  await repository.init();

  const outboxRepository = new OutboxRepository({
    dbPath: path.join(tempRoot, "app.sqlite"),
  });
  await outboxRepository.init();

  const extractWorks = createStaticExtractor((message) => {
    const lower = String(message).toLowerCase();
    if (lower.includes("bathroom")) {
      return {
        works: [
          { category: "tiling", type: "demolition_no_lift", quantity: 1 },
          { category: "tiling", type: "tile_60_120", quantity: 1 },
        ],
      };
    }

    return { works: [] };
  });
  const agent = createChatAgent({ extractWorks });

  const crmClient = {
    async sendLead(_leadDto, { dryRun = false } = {}) {
      return {
        sent: !dryRun,
        mode: dryRun ? "dry_run" : "stub",
      };
    },
  };

  const outboxProcessor = new CrmOutboxProcessor({
    repository: outboxRepository,
    crmClient,
    logger: {
      info() {},
      error() {},
    },
  });

  const app = createHttpApp({
    repository,
    agent,
    crmClient,
    outboxProcessor,
    metrics: createAppMetrics({ prefix: "valik" }),
    security: {
      spamMinIntervalMs: 1,
      rateLimitMaxRequests: 1000,
      ...security,
    },
  });
  const port = await app.start(0);

  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      await app.stop();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

test("staging smoke succeeds with API/admin/metrics keys", async () => {
  const runtime = await buildRuntime({
    security: {
      apiKey: "api-key",
      adminApiKey: "admin-key",
      metricsApiKey: "metrics-key",
    },
  });

  try {
    const report = await runStagingSmoke({
      baseUrl: runtime.baseUrl,
      apiKey: "api-key",
      adminApiKey: "admin-key",
      metricsApiKey: "metrics-key",
      strictMetrics: true,
      sendToCrm: false,
    });

    assert.equal(report.ok, true);
    assert.ok(report.results.some((item) => item.step === "health" && item.status === "passed"));
    assert.ok(
      report.results.some((item) => item.step === "outbox_admin" && item.status === "passed"),
    );
  } finally {
    await runtime.cleanup();
  }
});

test("staging smoke skips optional checks when keys are not provided", async () => {
  const runtime = await buildRuntime();

  try {
    const report = await runStagingSmoke({
      baseUrl: runtime.baseUrl,
    });

    assert.equal(report.ok, true);
    assert.ok(
      report.results.some((item) => item.step === "metrics" && item.status === "skipped"),
    );
    assert.ok(
      report.results.some((item) => item.step === "outbox_admin" && item.status === "skipped"),
    );
  } finally {
    await runtime.cleanup();
  }
});
