import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAlertSignatureHeader,
  parseAlertSignatureHeader,
  verifyAlertSignature,
} from "../security/alert-signature.js";

test("alert signature: parse returns digest for valid v1 header", () => {
  const parsed = parseAlertSignatureHeader(
    "v1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );

  assert.ok(parsed);
  assert.equal(parsed.version, "v1");
  assert.equal(
    parsed.digest,
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
});

test("alert signature: verify succeeds for valid payload/timestamp/signature", () => {
  const signingSecret = "super-secret";
  const timestamp = "1700000000";
  const payloadText = JSON.stringify({
    type: "crm_outbox_dead_lettered",
    job_id: "job-1",
  });
  const signatureHeader = buildAlertSignatureHeader({
    signingSecret,
    timestamp,
    payloadText,
  });

  const result = verifyAlertSignature({
    signingSecret,
    timestamp,
    payloadText,
    signatureHeader,
    maxSkewSeconds: 60,
    nowEpochSeconds: 1700000020,
  });

  assert.deepEqual(result, { ok: true, reason: "ok" });
});

test("alert signature: verify fails for mismatched payload", () => {
  const signingSecret = "super-secret";
  const timestamp = "1700000000";
  const payloadText = JSON.stringify({ type: "a" });
  const signatureHeader = buildAlertSignatureHeader({
    signingSecret,
    timestamp,
    payloadText,
  });

  const result = verifyAlertSignature({
    signingSecret,
    timestamp,
    payloadText: JSON.stringify({ type: "b" }),
    signatureHeader,
    nowEpochSeconds: 1700000020,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "digest_mismatch");
});

test("alert signature: verify fails for stale timestamp", () => {
  const signingSecret = "super-secret";
  const timestamp = "1700000000";
  const payloadText = "{}";
  const signatureHeader = buildAlertSignatureHeader({
    signingSecret,
    timestamp,
    payloadText,
  });

  const result = verifyAlertSignature({
    signingSecret,
    timestamp,
    payloadText,
    signatureHeader,
    maxSkewSeconds: 10,
    nowEpochSeconds: 1700000030,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "timestamp_out_of_range");
  assert.equal(result.skewSeconds, 30);
});

test("alert signature: verify fails for malformed header", () => {
  const result = verifyAlertSignature({
    signingSecret: "secret",
    timestamp: "1700000000",
    payloadText: "{}",
    signatureHeader: "bad-signature",
    nowEpochSeconds: 1700000001,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_signature_header");
});
