function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch (error) {
    return null;
  }
}

function parseAllowlist(rawValue) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter(Boolean);
}

function parseIpAllowlist(rawValue) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildSecurityConfig(overrides = {}) {
  const env = process.env;

  return {
    apiKey: overrides.apiKey ?? env.API_AUTH_KEY ?? null,
    adminApiKey: overrides.adminApiKey ?? env.ADMIN_API_KEY ?? null,
    metricsApiKey: overrides.metricsApiKey ?? env.METRICS_API_KEY ?? null,
    metricsIpAllowlist:
      overrides.metricsIpAllowlist ??
      parseIpAllowlist(env.METRICS_IP_ALLOWLIST ?? ""),
    corsAllowlist:
      overrides.corsAllowlist ?? parseAllowlist(env.CORS_ALLOWLIST ?? ""),
    rateLimitWindowMs:
      overrides.rateLimitWindowMs ??
      parseNumber(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxRequests:
      overrides.rateLimitMaxRequests ??
      parseNumber(env.RATE_LIMIT_MAX_REQUESTS, 80),
    spamMaxMessageLength:
      overrides.spamMaxMessageLength ??
      parseNumber(env.SPAM_MAX_MESSAGE_LENGTH, 1200),
    spamMinIntervalMs:
      overrides.spamMinIntervalMs ??
      parseNumber(env.SPAM_MIN_INTERVAL_MS, 1200),
    spamDuplicateWindowMs:
      overrides.spamDuplicateWindowMs ??
      parseNumber(env.SPAM_DUPLICATE_WINDOW_MS, 15_000),
    spamMaxDuplicateBursts:
      overrides.spamMaxDuplicateBursts ??
      parseNumber(env.SPAM_MAX_DUPLICATE_BURSTS, 2),
    spamMaxUrls:
      overrides.spamMaxUrls ?? parseNumber(env.SPAM_MAX_URLS, 3),
  };
}

export function getNormalizedOrigin(originHeader) {
  if (typeof originHeader !== "string" || !originHeader.trim()) {
    return null;
  }

  return normalizeOrigin(originHeader);
}
