import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHttpApp } from "../server/app.js";
import { SessionRepository } from "../storage/repository.js";
import { createStaticExtractor } from "../services/extractor.js";
import { createChatAgent } from "../services/chat-agent.js";

async function buildSecurityApp(securityOverrides = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "valik-security-test-"));
  const repository = new SessionRepository({
    filePath: path.join(tempRoot, "sessions.json"),
  });
  await repository.init();

  const extractWorks = createStaticExtractor(() => ({
    works: [{ category: "tiling", type: "tile_60_120", quantity: 1 }],
  }));
  const agent = createChatAgent({ extractWorks });
  const crmClient = {
    async sendLead() {
      return { sent: false, mode: "stub" };
    },
  };

  const app = createHttpApp({
    repository,
    agent,
    crmClient,
    security: {
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1000,
      spamMinIntervalMs: 1000,
      ...securityOverrides,
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

test("security: API key is required when configured", async () => {
  const runtime = await buildSecurityApp({ apiKey: "test-key" });

  try {
    let response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-key",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("security: public chat routes bypass API key but service routes stay protected", async () => {
  const runtime = await buildSecurityApp({
    apiKey: "test-key",
    publicChatRoutes: true,
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.sessionId);

    response = await fetch(`${runtime.baseUrl}/api/estimate/${payload.sessionId}`);
    assert.equal(response.status, 200);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`);
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`, {
      headers: {
        "X-API-Key": "test-key",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("security: CORS allowlist blocks unknown origin", async () => {
  const runtime = await buildSecurityApp({
    apiKey: "test-key",
    corsAllowlist: ["https://allowed.example"],
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-key",
        Origin: "https://blocked.example",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);

    response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-key",
        Origin: "https://allowed.example",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://allowed.example",
    );
  } finally {
    await runtime.cleanup();
  }
});

test("security: rate limit returns 429 and Retry-After", async () => {
  const runtime = await buildSecurityApp({
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 2,
  });

  try {
    const call = () =>
      fetch(`${runtime.baseUrl}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

    let response = await call();
    assert.equal(response.status, 200);
    response = await call();
    assert.equal(response.status, 200);
    response = await call();
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get("retry-after")) >= 1);
  } finally {
    await runtime.cleanup();
  }
});

test("security: anti-spam blocks too fast follow-up messages", async () => {
  const runtime = await buildSecurityApp({
    spamMinIntervalMs: 60_000,
    rateLimitMaxRequests: 1000,
  });

  try {
    const startResponse = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bathroom 6m2, tile 60x60",
      }),
    });

    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();
    assert.ok(started.sessionId);

    const fastMessage = await fetch(`${runtime.baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: started.sessionId,
        message: "Warsaw",
      }),
    });

    assert.equal(fastMessage.status, 429);
    const payload = await fastMessage.json();
    assert.ok(payload.error.includes("too quickly"));
  } finally {
    await runtime.cleanup();
  }
});

test("security: admin API key protects outbox endpoints", async () => {
  const runtime = await buildSecurityApp({
    adminApiKey: "admin-key",
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`);
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`, {
      headers: {
        "X-API-Key": "admin-key",
      },
    });
    assert.equal(response.status, 200);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "admin-key",
      },
      body: JSON.stringify({ limit: 10 }),
    });
    assert.equal(response.status, 200);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox/dlq?limit=10`, {
      headers: {
        "X-API-Key": "admin-key",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("security: admin routes use admin key when both API keys are configured", async () => {
  const runtime = await buildSecurityApp({
    apiKey: "public-key",
    adminApiKey: "admin-key",
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/api/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "public-key",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`, {
      headers: {
        "X-API-Key": "public-key",
      },
    });
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.baseUrl}/api/integrations/crm/outbox?limit=10`, {
      headers: {
        "X-API-Key": "admin-key",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("security: metrics endpoint requires metrics API key when configured", async () => {
  const runtime = await buildSecurityApp({
    metricsApiKey: "metrics-key",
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/metrics`);
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.baseUrl}/metrics`, {
      headers: {
        "X-API-Key": "metrics-key",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});

test("security: metrics endpoint supports IP allowlist", async () => {
  const runtime = await buildSecurityApp({
    metricsIpAllowlist: ["203.0.113.10"],
  });

  try {
    let response = await fetch(`${runtime.baseUrl}/metrics`);
    assert.equal(response.status, 403);

    response = await fetch(`${runtime.baseUrl}/metrics`, {
      headers: {
        "X-Forwarded-For": "203.0.113.10",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await runtime.cleanup();
  }
});
