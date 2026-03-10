import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { OutboxRepository } from "../storage/outbox-repository.js";
import { CrmOutboxProcessor } from "../services/outbox-processor.js";

async function buildOutboxRuntime({
  sendLead,
  maxAttempts = 3,
  alertHandler = null,
}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "valik-outbox-test-"));
  const repository = new OutboxRepository({
    filePath: path.join(tempRoot, "outbox.json"),
  });
  await repository.init();

  const processor = new CrmOutboxProcessor({
    repository,
    crmClient: { sendLead },
    maxAttempts,
    backoffBaseMs: 5,
    backoffMaxMs: 20,
    logger: {
      info() {},
      error() {},
    },
    alertHandler,
  });

  return {
    repository,
    processor,
    cleanup: async () => {
      await processor.close();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

test("outbox processor marks job as sent on successful delivery", async () => {
  const runtime = await buildOutboxRuntime({
    sendLead: async () => ({ sent: true, mode: "stub" }),
  });

  try {
    const job = await runtime.processor.enqueueLead({
      sessionId: "session-1",
      leadDto: { source: "test" },
    });

    const result = await runtime.processor.processJob(job.id);
    assert.equal(result.status, "sent");

    const stored = await runtime.repository.getJob(job.id);
    assert.equal(stored.status, "sent");
    assert.equal(stored.attempts, 1);
    assert.equal(stored.lastError, null);
  } finally {
    await runtime.cleanup();
  }
});

test("outbox processor retries failed delivery and stores backoff metadata", async () => {
  let attempts = 0;
  const runtime = await buildOutboxRuntime({
    sendLead: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary failure");
      }

      return { sent: true, mode: "stub" };
    },
  });

  try {
    const job = await runtime.processor.enqueueLead({
      sessionId: "session-2",
      leadDto: { source: "test" },
    });

    const firstResult = await runtime.processor.processJob(job.id);
    assert.equal(firstResult.status, "pending");
    assert.equal(firstResult.job.attempts, 1);
    assert.ok(firstResult.job.nextAttemptAt);

    await new Promise((resolve) => setTimeout(resolve, 12));
    const summary = await runtime.processor.processPending({ limit: 5 });
    assert.equal(summary.processed, 1);
    assert.equal(summary.sent, 1);

    const stored = await runtime.repository.getJob(job.id);
    assert.equal(stored.status, "sent");
    assert.equal(stored.attempts, 2);
  } finally {
    await runtime.cleanup();
  }
});

test("outbox processor marks job as failed after max attempts", async () => {
  const runtime = await buildOutboxRuntime({
    sendLead: async () => {
      throw new Error("permanent failure");
    },
  });

  try {
    const job = await runtime.processor.enqueueLead({
      sessionId: "session-3",
      leadDto: { source: "test" },
    });

    await runtime.processor.processJob(job.id);
    await new Promise((resolve) => setTimeout(resolve, 8));
    await runtime.processor.processPending({ limit: 5 });
    await new Promise((resolve) => setTimeout(resolve, 14));
    await runtime.processor.processPending({ limit: 5 });

    const finalJob = await runtime.repository.getJob(job.id);
    assert.equal(finalJob.status, "failed");
    assert.equal(finalJob.maxAttemptsReached, true);
    assert.equal(finalJob.attempts, 3);
  } finally {
    await runtime.cleanup();
  }
});

test("outbox processor triggers dead-letter alert handler on final failure", async () => {
  const alerts = [];
  const runtime = await buildOutboxRuntime({
    maxAttempts: 1,
    sendLead: async () => {
      throw new Error("final failure");
    },
    alertHandler: async (payload) => {
      alerts.push(payload);
    },
  });

  try {
    const job = await runtime.processor.enqueueLead({
      sessionId: "session-4",
      leadDto: { source: "test" },
    });

    const result = await runtime.processor.processJob(job.id);
    assert.equal(result.status, "failed");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "crm_outbox_dead_lettered");
    assert.equal(alerts[0].job_id, job.id);
    assert.equal(alerts[0].session_id, "session-4");
    assert.ok(alerts[0].dead_letter_at);
  } finally {
    await runtime.cleanup();
  }
});
