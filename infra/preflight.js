import path from "node:path";
import { constants as fsConstants, promises as fs } from "node:fs";

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCsv(rawValue) {
  if (!rawValue) {
    return [];
  }

  return String(rawValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDatabasePath({ env, cwd }) {
  const configured = String(env.DATABASE_PATH ?? "").trim();
  if (configured.length > 0) {
    return path.resolve(cwd, configured);
  }

  return path.resolve(cwd, "data", "app.sqlite");
}

async function checkDatabaseDirectoryWritable(dbPath) {
  const dbDirectory = path.dirname(dbPath);
  try {
    await fs.mkdir(dbDirectory, { recursive: true });
    await fs.access(dbDirectory, fsConstants.W_OK);
    return { ok: true, dbDirectory };
  } catch (error) {
    return {
      ok: false,
      dbDirectory,
      error: `Database directory is not writable: ${dbDirectory}`,
    };
  }
}

export async function evaluateRuntimeConfig({
  env = process.env,
  cwd = process.cwd(),
  checkDatabaseAccess = true,
} = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const publicChatRoutes = parseBoolean(
    env.PUBLIC_CHAT_ROUTES ?? env.PUBLIC_WIDGET_MODE ?? false,
  );

  if (!String(env.OPENAI_API_KEY ?? "").trim()) {
    errors.push("OPENAI_API_KEY is required for createDefaultApp().");
  }

  const databasePath = resolveDatabasePath({ env, cwd });
  notes.push(`DATABASE_PATH resolved to: ${databasePath}`);

  if (checkDatabaseAccess) {
    const dbCheck = await checkDatabaseDirectoryWritable(databasePath);
    if (!dbCheck.ok) {
      errors.push(dbCheck.error);
    }
  }

  if (!String(env.API_AUTH_KEY ?? "").trim()) {
    if (publicChatRoutes) {
      warnings.push(
        "API_AUTH_KEY is not set and PUBLIC_CHAT_ROUTES is enabled. Public API routes are unprotected.",
      );
    } else {
      warnings.push("API_AUTH_KEY is not set. Public API routes are unprotected.");
    }
  } else if (publicChatRoutes) {
    warnings.push(
      "PUBLIC_CHAT_ROUTES is enabled. Chat and estimate endpoints are accessible without API_AUTH_KEY.",
    );
  }

  if (!String(env.ADMIN_API_KEY ?? "").trim()) {
    warnings.push(
      "ADMIN_API_KEY is not set. Outbox admin routes can only rely on API_AUTH_KEY.",
    );
  }

  const metricsApiKey = String(env.METRICS_API_KEY ?? "").trim();
  const metricsIpAllowlist = parseCsv(env.METRICS_IP_ALLOWLIST);
  if (!metricsApiKey && metricsIpAllowlist.length === 0) {
    warnings.push("Metrics endpoint is not protected (METRICS_API_KEY / METRICS_IP_ALLOWLIST).");
  }

  const corsAllowlist = parseCsv(env.CORS_ALLOWLIST);
  if (corsAllowlist.length === 0) {
    warnings.push("CORS_ALLOWLIST is empty. Browser origins are not restricted.");
  }

  if (String(env.ALERT_WEBHOOK_URL ?? "").trim()) {
    if (!String(env.ALERT_SIGNING_SECRET ?? "").trim()) {
      warnings.push(
        "ALERT_WEBHOOK_URL is set without ALERT_SIGNING_SECRET. Webhook authenticity cannot be verified.",
      );
    }

    const timeoutMs = parsePositiveInt(env.ALERT_TIMEOUT_MS);
    if (env.ALERT_TIMEOUT_MS && !timeoutMs) {
      errors.push("ALERT_TIMEOUT_MS must be a positive integer.");
    }
  }

  if (String(env.CRM_WEBHOOK_URL ?? "").trim() && !String(env.CRM_API_KEY ?? "").trim()) {
    warnings.push("CRM_WEBHOOK_URL is set without CRM_API_KEY.");
  }

  const outboxAttempts = parsePositiveInt(env.OUTBOX_MAX_ATTEMPTS ?? 6);
  if (!outboxAttempts) {
    errors.push("OUTBOX_MAX_ATTEMPTS must be a positive integer.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    notes,
    databasePath,
  };
}

export function formatPreflightReport(report) {
  const lines = [];
  lines.push(`Preflight status: ${report.ok ? "OK" : "FAILED"}`);

  if (report.notes.length > 0) {
    lines.push("");
    lines.push("Notes:");
    report.notes.forEach((item) => lines.push(`- ${item}`));
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    report.warnings.forEach((item) => lines.push(`- ${item}`));
  }

  if (report.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    report.errors.forEach((item) => lines.push(`- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}
