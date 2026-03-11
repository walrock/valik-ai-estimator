import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRuntimeConfig } from "../infra/preflight.js";

test("preflight fails when OPENAI_API_KEY is missing", async () => {
  const report = await evaluateRuntimeConfig({
    env: {
      DATABASE_PATH: "./data/app.sqlite",
    },
    checkDatabaseAccess: false,
  });

  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("OPENAI_API_KEY")));
});

test("preflight warns when metrics endpoint is not protected", async () => {
  const report = await evaluateRuntimeConfig({
    env: {
      OPENAI_API_KEY: "test-key",
      DATABASE_PATH: "./data/app.sqlite",
      API_AUTH_KEY: "api-key",
      ADMIN_API_KEY: "admin-key",
      CORS_ALLOWLIST: "https://example.com",
    },
    checkDatabaseAccess: false,
  });

  assert.equal(report.ok, true);
  assert.ok(report.warnings.some((item) => item.includes("Metrics endpoint")));
});

test("preflight flags invalid ALERT_TIMEOUT_MS", async () => {
  const report = await evaluateRuntimeConfig({
    env: {
      OPENAI_API_KEY: "test-key",
      DATABASE_PATH: "./data/app.sqlite",
      ALERT_WEBHOOK_URL: "https://alerts.example.com/hook",
      ALERT_TIMEOUT_MS: "not-a-number",
    },
    checkDatabaseAccess: false,
  });

  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("ALERT_TIMEOUT_MS")));
});

test("preflight passes with strict security settings", async () => {
  const report = await evaluateRuntimeConfig({
    env: {
      OPENAI_API_KEY: "test-key",
      DATABASE_PATH: "./data/app.sqlite",
      API_AUTH_KEY: "api-key",
      ADMIN_API_KEY: "admin-key",
      METRICS_API_KEY: "metrics-key",
      CORS_ALLOWLIST: "https://example.com",
      OUTBOX_MAX_ATTEMPTS: "6",
    },
    checkDatabaseAccess: false,
  });

  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
});

test("preflight warns when public chat routes are enabled", async () => {
  const report = await evaluateRuntimeConfig({
    env: {
      OPENAI_API_KEY: "test-key",
      DATABASE_PATH: "./data/app.sqlite",
      API_AUTH_KEY: "api-key",
      ADMIN_API_KEY: "admin-key",
      METRICS_API_KEY: "metrics-key",
      CORS_ALLOWLIST: "https://example.com",
      PUBLIC_CHAT_ROUTES: "true",
      OUTBOX_MAX_ATTEMPTS: "6",
    },
    checkDatabaseAccess: false,
  });

  assert.equal(report.ok, true);
  assert.ok(report.warnings.some((item) => item.includes("PUBLIC_CHAT_ROUTES")));
});
