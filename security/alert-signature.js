import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_VERSION = "v1";
const HEX_256_REGEX = /^[a-f0-9]{64}$/i;

function toEpochSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.floor(numeric);
}

function safeCompareHex(leftHex, rightHex) {
  const left = Buffer.from(String(leftHex), "hex");
  const right = Buffer.from(String(rightHex), "hex");
  if (left.length !== right.length || left.length === 0) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function buildAlertSignatureDigest({
  signingSecret,
  timestamp,
  payloadText,
} = {}) {
  if (!signingSecret) {
    throw new Error("signingSecret is required.");
  }

  const normalizedTimestamp = toEpochSeconds(timestamp);
  if (!normalizedTimestamp) {
    throw new Error("timestamp must be a positive integer in epoch seconds.");
  }

  return createHmac("sha256", signingSecret)
    .update(`${normalizedTimestamp}.${String(payloadText ?? "")}`)
    .digest("hex");
}

export function buildAlertSignatureHeader({
  signingSecret,
  timestamp,
  payloadText,
} = {}) {
  const digest = buildAlertSignatureDigest({
    signingSecret,
    timestamp,
    payloadText,
  });
  return `${SIGNATURE_VERSION}=${digest}`;
}

export function parseAlertSignatureHeader(signatureHeader) {
  if (typeof signatureHeader !== "string" || !signatureHeader.length) {
    return null;
  }

  const [version, digest] = signatureHeader.split("=");
  if (version !== SIGNATURE_VERSION) {
    return null;
  }

  if (!HEX_256_REGEX.test(digest ?? "")) {
    return null;
  }

  return { version, digest: digest.toLowerCase() };
}

export function verifyAlertSignature({
  signingSecret,
  timestamp,
  payloadText,
  signatureHeader,
  maxSkewSeconds = 300,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  if (!signingSecret) {
    return { ok: false, reason: "missing_secret" };
  }

  const parsedSignature = parseAlertSignatureHeader(signatureHeader);
  if (!parsedSignature) {
    return { ok: false, reason: "invalid_signature_header" };
  }

  const eventTimestamp = toEpochSeconds(timestamp);
  if (!eventTimestamp || eventTimestamp <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const currentTimestamp = toEpochSeconds(nowEpochSeconds);
  if (!currentTimestamp || currentTimestamp <= 0) {
    return { ok: false, reason: "invalid_now" };
  }

  const skew = Math.abs(currentTimestamp - eventTimestamp);
  if (skew > Number(maxSkewSeconds)) {
    return { ok: false, reason: "timestamp_out_of_range", skewSeconds: skew };
  }

  const expectedDigest = buildAlertSignatureDigest({
    signingSecret,
    timestamp: eventTimestamp,
    payloadText,
  });

  if (!safeCompareHex(expectedDigest, parsedSignature.digest)) {
    return { ok: false, reason: "digest_mismatch" };
  }

  return { ok: true, reason: "ok" };
}
