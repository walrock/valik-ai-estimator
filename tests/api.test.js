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

async function buildTestApp({
  crmSendLead = null,
  outboxMaxAttempts = 3,
  outboxBackoffBaseMs = 5,
  outboxBackoffMaxMs = 10,
} = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "valik-api-test-"));
  const repository = new SessionRepository({
    filePath: path.join(tempRoot, "sessions.json"),
  });
  await repository.init();
  const outboxRepository = new OutboxRepository({
    filePath: path.join(tempRoot, "outbox.json"),
  });
  await outboxRepository.init();

  const extractWorks = createStaticExtractor((message) => {
    const lower = String(message).toLowerCase();
    if (lower.includes("bathroom")) {
      return {
        works: [
          { category: "tiling", type: "demolition_no_lift", quantity: 1 },
          { category: "tiling", type: "tile_60_120", quantity: 1 },
          { category: "painting", type: "primer", quantity: 1 },
          { category: "painting", type: "paint_2_layers", quantity: 1 },
        ],
      };
    }

    return { works: [] };
  });

  const agent = createChatAgent({ extractWorks });
  const crmCalls = [];
  const crmClient = {
    async sendLead(leadDto, { dryRun = false } = {}) {
      crmCalls.push({ leadDto, dryRun });

      if (typeof crmSendLead === "function") {
        return crmSendLead(leadDto, { dryRun, crmCalls });
      }

      return {
        sent: !dryRun,
        mode: dryRun ? "dry_run" : "stub",
      };
    },
  };
  const outboxProcessor = new CrmOutboxProcessor({
    repository: outboxRepository,
    crmClient,
    maxAttempts: outboxMaxAttempts,
    backoffBaseMs: outboxBackoffBaseMs,
    backoffMaxMs: outboxBackoffMaxMs,
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
    security: {
      spamMinIntervalMs: 1,
      rateLimitMaxRequests: 1000,
    },
  });
  const port = await app.start(0);

  return {
    app,
    crmCalls,
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      await app.stop();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

test("API workflow: start chat, clarify details, get estimate and confirm", async () => {
  const runtime = await buildTestApp();

  try {
    const startResponse = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bathroom 6m2, remove old tiles, prime and paint.",
      }),
    });

    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();
    assert.ok(started.sessionId);
    assert.equal(started.status, "needs_clarification");
    assert.equal(started.language, "en");
    assert.ok(started.assistantMessage.includes("I need a few more details"));
    assert.equal(started.estimate.subtotal, 1650);
    assert.ok(started.missingFields.includes("lift_access"));
    assert.ok(started.missingFields.includes("floor_number"));

    const messageResponse = await fetch(`${runtime.baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: started.sessionId,
        message: "Warsaw, next week, 3 floor, with lift.",
      }),
    });

    assert.equal(messageResponse.status, 200);
    const updated = await messageResponse.json();
    assert.equal(updated.status, "ready_for_confirmation");
    assert.deepEqual(updated.missingFields, []);

    const estimateResponse = await fetch(
      `${runtime.baseUrl}/api/estimate/${started.sessionId}`,
    );
    assert.equal(estimateResponse.status, 200);
    const estimatePayload = await estimateResponse.json();
    assert.equal(estimatePayload.status, "ready_for_confirmation");
    assert.equal(estimatePayload.estimate.total, 1650);

    const confirmResponse = await fetch(`${runtime.baseUrl}/api/estimate/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, sendToCrm: true }),
    });
    assert.equal(confirmResponse.status, 200);
    const confirmed = await confirmResponse.json();
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.transferPayload.sessionId, started.sessionId);
    assert.equal(confirmed.crmLead.sessionId, started.sessionId);
    assert.equal(confirmed.crmResult.status, "sent");
    assert.equal(confirmed.crmResult.delivery.mode, "stub");
    assert.equal(runtime.crmCalls.length, 1);

    const crmLeadResponse = await fetch(`${runtime.baseUrl}/api/integrations/crm/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, dryRun: true }),
    });
    assert.equal(crmLeadResponse.status, 200);
    const crmPayload = await crmLeadResponse.json();
    assert.equal(crmPayload.crmResult.mode, "dry_run");
    assert.equal(crmPayload.crmLead.sessionId, started.sessionId);
    assert.equal(runtime.crmCalls.length, 2);

    const outboxListResponse = await fetch(
      `${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`,
    );
    assert.equal(outboxListResponse.status, 200);
    const outboxList = await outboxListResponse.json();
    assert.ok(outboxList.count >= 1);

    const outboxProcessResponse = await fetch(
      `${runtime.baseUrl}/api/integrations/crm/outbox/process`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      },
    );
    assert.equal(outboxProcessResponse.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("API start endpoint supports empty body and returns initial prompt", async () => {
  const runtime = await buildTestApp();

  try {
    const response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.sessionId);
    assert.equal(payload.status, "active");
    assert.equal(payload.language, "pl");
    assert.ok(payload.assistantMessage.length > 0);
    assert.ok(payload.missingFields.includes("work_scope"));
  } finally {
    await runtime.cleanup();
  }
});

test("API responds in Russian when the user message is in Cyrillic", async () => {
  const runtime = await buildTestApp();

  try {
    const response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "\u043f\u0440\u0438\u0432\u0435\u0442, \u043d\u0443\u0436\u043d\u0430 \u0441\u043c\u0435\u0442\u0430",
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, "needs_clarification");
    assert.equal(payload.language, "ru");
    assert.match(payload.assistantMessage, /[\u0400-\u04FF]/u);
  } finally {
    await runtime.cleanup();
  }
});

test("API serves widget static page", async () => {
  const runtime = await buildTestApp();

  try {
    const response = await fetch(`${runtime.baseUrl}/`);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.ok(html.includes("Kalkulator Wyceny AI"));
    assert.ok(html.includes("/widget.js"));
  } finally {
    await runtime.cleanup();
  }
});

test("API serves embed script", async () => {
  const runtime = await buildTestApp();

  try {
    const response = await fetch(`${runtime.baseUrl}/embed.js`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/javascript/);

    const script = await response.text();
    assert.ok(script.includes("initValikEstimatorEmbed"));
  } finally {
    await runtime.cleanup();
  }
});

test("API confirm is idempotent and does not duplicate CRM delivery", async () => {
  const runtime = await buildTestApp();

  try {
    const startResponse = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bathroom 6m2, remove old tiles.",
      }),
    });
    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();

    const messageResponse = await fetch(`${runtime.baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: started.sessionId,
        message: "Warsaw, next week, 3 floor, with lift.",
      }),
    });
    assert.equal(messageResponse.status, 200);

    const firstConfirm = await fetch(`${runtime.baseUrl}/api/estimate/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, sendToCrm: true }),
    });
    assert.equal(firstConfirm.status, 200);
    const firstPayload = await firstConfirm.json();
    assert.equal(firstPayload.alreadyConfirmed, false);
    assert.equal(firstPayload.crmResult.status, "sent");

    const secondConfirm = await fetch(`${runtime.baseUrl}/api/estimate/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, sendToCrm: true }),
    });
    assert.equal(secondConfirm.status, 200);
    const secondPayload = await secondConfirm.json();
    assert.equal(secondPayload.alreadyConfirmed, true);
    assert.equal(secondPayload.crmResult.status, "sent");
    assert.equal(secondPayload.crmResult.reused, true);
    assert.equal(secondPayload.crmOutboxJob.id, firstPayload.crmOutboxJob.id);
    assert.equal(secondPayload.transferPayload.confirmedAt, firstPayload.transferPayload.confirmedAt);
    assert.equal(runtime.crmCalls.length, 1);

    const outboxResponse = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`);
    assert.equal(outboxResponse.status, 200);
    const outboxPayload = await outboxResponse.json();
    assert.equal(outboxPayload.count, 1);
  } finally {
    await runtime.cleanup();
  }
});

test("API exposes CRM DLQ entries for failed jobs", async () => {
  const runtime = await buildTestApp({
    outboxMaxAttempts: 1,
    crmSendLead: async (_lead, { dryRun }) => {
      if (dryRun) {
        return { sent: false, mode: "dry_run" };
      }

      throw new Error("crm temporary outage");
    },
  });

  try {
    const startResponse = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bathroom 6m2, remove old tiles.",
      }),
    });
    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();

    const messageResponse = await fetch(`${runtime.baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: started.sessionId,
        message: "Warsaw, next week, 3 floor, with lift.",
      }),
    });
    assert.equal(messageResponse.status, 200);

    const confirmResponse = await fetch(`${runtime.baseUrl}/api/estimate/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, sendToCrm: true }),
    });
    assert.equal(confirmResponse.status, 200);
    const confirmed = await confirmResponse.json();
    assert.equal(confirmed.crmResult.status, "failed");
    assert.equal(confirmed.crmOutboxJob.status, "pending");

    const dlqResponse = await fetch(
      `${runtime.baseUrl}/api/integrations/crm/outbox/dlq?limit=10`,
    );
    assert.equal(dlqResponse.status, 200);
    const dlqPayload = await dlqResponse.json();
    assert.equal(dlqPayload.count, 1);
    assert.equal(dlqPayload.jobs[0].status, "failed");
    assert.equal(dlqPayload.jobs[0].maxAttemptsReached, true);
    assert.ok(dlqPayload.jobs[0].deadLetterAt);
  } finally {
    await runtime.cleanup();
  }
});

