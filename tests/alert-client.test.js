import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import { createAlertClient } from "../services/alert-client.js";

async function createHttpCaptureServer({ statusCode = 200, body = "ok" } = {}) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
    }

    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: rawBody,
    });

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(body);
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}/alerts`,
    requests,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

test("alert client returns not_configured when webhook is absent", async () => {
  const client = createAlertClient({ webhookUrl: "" });
  const result = await client.sendEvent({ type: "crm_outbox_dead_lettered" });

  assert.equal(client.enabled, false);
  assert.equal(result.sent, false);
  assert.equal(result.mode, "not_configured");
});

test("alert client posts payload and authorization header", async () => {
  const capture = await createHttpCaptureServer();
  try {
    const client = createAlertClient({
      webhookUrl: capture.url,
      apiKey: "alert-secret",
      timeoutMs: 2000,
    });

    const payload = {
      type: "crm_outbox_dead_lettered",
      job_id: "job-1",
      error: "failed",
    };
    const result = await client.sendEvent(payload);

    assert.equal(result.sent, true);
    assert.equal(result.mode, "webhook");
    assert.equal(capture.requests.length, 1);
    assert.equal(capture.requests[0].method, "POST");
    assert.equal(capture.requests[0].headers.authorization, "Bearer alert-secret");
    assert.deepEqual(JSON.parse(capture.requests[0].body), payload);
  } finally {
    await capture.close();
  }
});

test("alert client throws when webhook returns error status", async () => {
  const capture = await createHttpCaptureServer({
    statusCode: 500,
    body: "upstream failed",
  });

  try {
    const client = createAlertClient({
      webhookUrl: capture.url,
      timeoutMs: 2000,
    });

    await assert.rejects(
      () => client.sendEvent({ type: "crm_outbox_dead_lettered" }),
      /Alert webhook failed with status 500/,
    );
  } finally {
    await capture.close();
  }
});

test("alert client signs payload with HMAC when signing secret is configured", async () => {
  const capture = await createHttpCaptureServer();
  try {
    const client = createAlertClient({
      webhookUrl: capture.url,
      signingSecret: "hmac-secret",
      timeoutMs: 2000,
    });

    const payload = {
      type: "crm_outbox_dead_lettered",
      job_id: "job-2",
      error: "final failure",
    };
    await client.sendEvent(payload);

    assert.equal(capture.requests.length, 1);
    const request = capture.requests[0];
    const timestamp = request.headers["x-alert-timestamp"];
    const signature = request.headers["x-alert-signature"];
    assert.ok(typeof timestamp === "string" && timestamp.length > 0);
    assert.ok(typeof signature === "string" && signature.startsWith("v1="));

    const expected = createHmac("sha256", "hmac-secret")
      .update(`${timestamp}.${request.body}`)
      .digest("hex");
    assert.equal(signature, `v1=${expected}`);
  } finally {
    await capture.close();
  }
});
