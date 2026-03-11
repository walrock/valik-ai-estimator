import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import dotenv from "dotenv";
import { SessionRepository } from "../storage/repository.js";
import { OutboxRepository } from "../storage/outbox-repository.js";
import { createOpenAIExtractor } from "../services/extractor.js";
import { createChatAgent } from "../services/chat-agent.js";
import { createCrmClient } from "../services/crm-client.js";
import { createAlertClient } from "../services/alert-client.js";
import { CrmOutboxProcessor } from "../services/outbox-processor.js";
import { buildCrmLeadDto } from "../dto/crm.js";
import { buildSecurityConfig, getNormalizedOrigin } from "../security/config.js";
import { MemoryRateLimiter } from "../security/rate-limiter.js";
import { MessageSpamGuard } from "../security/spam-guard.js";
import { extractApiKey, getClientIp } from "../security/request.js";
import { createLogger } from "../infra/logger.js";
import { createAppMetrics } from "../infra/metrics.js";

const DEFAULT_INITIAL_FIELDS = ["work_scope", "area_or_quantity", "deadline", "city"];
const PUBLIC_DIR = path.join(process.cwd(), "public");
const STATIC_ROUTES = Object.freeze({
  "/": { file: "widget.html", type: "text/html; charset=utf-8" },
  "/embed.js": { file: "embed.js", type: "application/javascript; charset=utf-8" },
  "/widget.js": { file: "widget.js", type: "application/javascript; charset=utf-8" },
  "/widget.css": { file: "widget.css", type: "text/css; charset=utf-8" },
});

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function nowNs() {
  return process.hrtime.bigint();
}

function nsToSeconds(value) {
  return Number(value) / 1_000_000_000;
}

function normalizeRouteForMetrics(method, pathname) {
  if (method === "GET" && /^\/api\/estimate\/[^/]+$/.test(pathname)) {
    return "/api/estimate/:id";
  }

  return pathname;
}

class HttpError extends Error {
  constructor(statusCode, message, details = undefined, headers = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.headers = headers;
  }
}

function isApiRoute(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublicChatRoute(method, pathname) {
  if (
    method === "POST" &&
    (pathname === "/api/chat/start" ||
      pathname === "/api/chat/message" ||
      pathname === "/api/estimate/confirm")
  ) {
    return true;
  }

  return method === "GET" && /^\/api\/estimate\/[^/]+$/.test(pathname);
}

function isOutboxAdminRoute(pathname) {
  return pathname.startsWith("/api/integrations/crm/outbox");
}

function isMetricsRoute(pathname) {
  return pathname === "/metrics";
}

function parsePathname(req) {
  const baseUrl = `http://${req.headers.host ?? "localhost"}`;
  return new URL(req.url ?? "/", baseUrl).pathname;
}

function parseSessionIdFromEstimatePath(pathname) {
  const match = pathname.match(/^\/api\/estimate\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function parseRequestIdHeader(value) {
  if (Array.isArray(value)) {
    return parseRequestIdHeader(value[0]);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function readJsonBody(req) {
  let rawBody = "";

  for await (const chunk of req) {
    rawBody += chunk;
    if (rawBody.length > 1024 * 1024) {
      throw new HttpError(413, "Request body is too large.");
    }
  }

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function selectCorsOrigin({ origin, allowlist }) {
  if (allowlist.length === 0) {
    return "*";
  }

  if (!origin) {
    return null;
  }

  if (allowlist.includes(origin)) {
    return origin;
  }

  return null;
}

export function createHttpApp({
  repository,
  agent,
  crmClient,
  outboxProcessor = null,
  security = {},
  logger = console,
  metrics = null,
}) {
  if (!repository || !agent || !crmClient) {
    throw new Error("repository, agent and crmClient are required.");
  }

  const deliveryOutbox =
    outboxProcessor ??
    {
      async enqueueLead({ sessionId, leadDto }) {
        return {
          id: null,
          sessionId,
          payload: leadDto,
          status: "disabled",
          attempts: 0,
          nextAttemptAt: null,
        };
      },
      async processJob() {
        return { skipped: true, reason: "outbox_disabled" };
      },
      async processPending() {
        return {
          skipped: true,
          reason: "outbox_disabled",
          processed: 0,
          sent: 0,
          failed: 0,
        };
      },
      async listJobs() {
        return [];
      },
      async listDeadLetterJobs() {
        return [];
      },
      async close() {},
    };

  const securityConfig = buildSecurityConfig(security);
  const rateLimiter = new MemoryRateLimiter({
    windowMs: securityConfig.rateLimitWindowMs,
    maxRequests: securityConfig.rateLimitMaxRequests,
  });
  const spamGuard = new MessageSpamGuard({
    maxLength: securityConfig.spamMaxMessageLength,
    minIntervalMs: securityConfig.spamMinIntervalMs,
    duplicateWindowMs: securityConfig.spamDuplicateWindowMs,
    maxDuplicateBursts: securityConfig.spamMaxDuplicateBursts,
    maxUrls: securityConfig.spamMaxUrls,
  });
  const appLogger =
    typeof logger?.child === "function"
      ? logger.child({ component: "http_app" })
      : logger;

  function setCorsHeaders(req, res) {
    const normalizedOrigin = getNormalizedOrigin(req.headers.origin);
    const allowedOrigin = selectCorsOrigin({
      origin: normalizedOrigin,
      allowlist: securityConfig.corsAllowlist,
    });

    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-API-Key, Authorization",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    return { normalizedOrigin, allowedOrigin };
  }

  function enforceCorsPolicy(pathname, corsState) {
    if (
      isApiRoute(pathname) &&
      securityConfig.corsAllowlist.length > 0 &&
      corsState.normalizedOrigin &&
      !corsState.allowedOrigin
    ) {
      throw new HttpError(
        403,
        `Origin ${corsState.normalizedOrigin} is not allowed by CORS policy.`,
      );
    }
  }

  function applyRateLimitHeaders(res, state) {
    if (!state) {
      return;
    }

    res.setHeader("X-RateLimit-Limit", String(securityConfig.rateLimitMaxRequests));
    res.setHeader("X-RateLimit-Remaining", String(state.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(state.resetAt / 1000)));
  }

  function sendJson(
    req,
    res,
    pathname,
    statusCode,
    payload,
    extraHeaders = undefined,
    skipCorsValidation = false,
  ) {
    const corsState = setCorsHeaders(req, res);
    if (!skipCorsValidation) {
      enforceCorsPolicy(pathname, corsState);
    }

    if (extraHeaders) {
      Object.entries(extraHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
      });
    }

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  }

  function sendText(
    req,
    res,
    pathname,
    statusCode,
    payload,
    contentType = "text/plain; charset=utf-8",
    extraHeaders = undefined,
    skipCorsValidation = false,
  ) {
    const corsState = setCorsHeaders(req, res);
    if (!skipCorsValidation) {
      enforceCorsPolicy(pathname, corsState);
    }

    if (extraHeaders) {
      Object.entries(extraHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
      });
    }

    res.statusCode = statusCode;
    res.setHeader("Content-Type", contentType);
    res.end(String(payload ?? ""));
  }

  async function sendStaticFile(req, res, pathname) {
    const route = STATIC_ROUTES[pathname];
    if (!route) {
      return false;
    }

    const absolutePath = path.join(PUBLIC_DIR, route.file);

    try {
      const content = await fs.readFile(absolutePath);
      const corsState = setCorsHeaders(req, res);
      enforceCorsPolicy(pathname, corsState);
      res.statusCode = 200;
      res.setHeader("Content-Type", route.type);
      res.end(content);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new HttpError(404, `Static file not found: ${pathname}`);
      }

      throw error;
    }
  }

  function enforceApiKey(req, pathname, method) {
    if (!isApiRoute(pathname) || !securityConfig.apiKey) {
      return;
    }

    if (securityConfig.publicChatRoutes && isPublicChatRoute(method, pathname)) {
      return;
    }

    if (isOutboxAdminRoute(pathname) && securityConfig.adminApiKey) {
      return;
    }

    const incoming = extractApiKey(req);
    if (!incoming || incoming !== securityConfig.apiKey) {
      throw new HttpError(401, "Unauthorized.");
    }
  }

  function enforceAdminApiKey(req, pathname) {
    if (!isOutboxAdminRoute(pathname) || !securityConfig.adminApiKey) {
      return;
    }

    const incoming = extractApiKey(req);
    if (!incoming || incoming !== securityConfig.adminApiKey) {
      throw new HttpError(401, "Unauthorized.");
    }
  }

  function enforceMetricsAccess(req, pathname) {
    if (!isMetricsRoute(pathname)) {
      return;
    }

    const hasKey = Boolean(securityConfig.metricsApiKey);
    const hasIpAllowlist = securityConfig.metricsIpAllowlist.length > 0;
    if (!hasKey && !hasIpAllowlist) {
      return;
    }

    const incomingKey = extractApiKey(req);
    const keyAuthorized = hasKey && incomingKey === securityConfig.metricsApiKey;

    const clientIp = getClientIp(req);
    const ipAuthorized = hasIpAllowlist && securityConfig.metricsIpAllowlist.includes(clientIp);

    if (hasKey && hasIpAllowlist) {
      if (keyAuthorized || ipAuthorized) {
        return;
      }

      throw new HttpError(401, "Unauthorized.");
    }

    if (hasKey && !keyAuthorized) {
      throw new HttpError(401, "Unauthorized.");
    }

    if (hasIpAllowlist && !ipAuthorized) {
      throw new HttpError(403, "Forbidden.");
    }
  }

  function enforceRateLimit(req, pathname) {
    if (!isApiRoute(pathname)) {
      return null;
    }

    const key = getClientIp(req);
    const state = rateLimiter.check(key);
    if (!state.allowed) {
      throw new HttpError(
        429,
        "Rate limit exceeded.",
        { retryAfterSeconds: state.retryAfterSeconds },
        { "Retry-After": String(state.retryAfterSeconds) },
      );
    }

    return state;
  }

  function enforceMessageSafety({ req, message, sessionId, pathname }) {
    if (!isApiRoute(pathname)) {
      return;
    }

    const ip = getClientIp(req);
    const key = `${ip}:${sessionId ?? "new"}`;
    const decision = spamGuard.inspect({ key, message });

    if (!decision.ok) {
      const headers = decision.retryAfterSeconds
        ? { "Retry-After": String(decision.retryAfterSeconds) }
        : undefined;
      throw new HttpError(decision.statusCode, decision.error, undefined, headers);
    }
  }

  const server = http.createServer(async (req, res) => {
    const startedAtNs = nowNs();
    const method = String(req.method ?? "GET").toUpperCase();
    const requestId = parseRequestIdHeader(req.headers["x-request-id"]) ?? randomUUID();
    res.setHeader("X-Request-Id", requestId);

    const requestLogger =
      typeof appLogger?.child === "function"
        ? appLogger.child({ request_id: requestId })
        : appLogger;
    let pathname = "/";
    res.once("finish", () => {
      const route = normalizeRouteForMetrics(method, pathname);
      const status = String(res.statusCode ?? 0);
      const durationSeconds = nsToSeconds(nowNs() - startedAtNs);

      metrics?.httpRequestsTotal?.inc({ method, route, status }, 1);
      metrics?.httpRequestDuration?.observe({ method, route, status }, durationSeconds);

      const fields = {
        request_id: requestId,
        method,
        pathname,
        route,
        status_code: res.statusCode ?? 0,
        duration_ms: Math.round(durationSeconds * 1000),
        client_ip: getClientIp(req),
      };

      if ((res.statusCode ?? 0) >= 500) {
        requestLogger.error?.("http_request", fields);
      } else if ((res.statusCode ?? 0) >= 400) {
        requestLogger.warn?.("http_request", fields);
      } else {
        requestLogger.info?.("http_request", fields);
      }
    });

    try {
      pathname = parsePathname(req);
      const corsState = setCorsHeaders(req, res);
      enforceCorsPolicy(pathname, corsState);

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method === "GET") {
        const sent = await sendStaticFile(req, res, pathname);
        if (sent) {
          return;
        }
      }

      enforceApiKey(req, pathname, method);
      enforceAdminApiKey(req, pathname);
      enforceMetricsAccess(req, pathname);
      const rateLimitState = enforceRateLimit(req, pathname);
      applyRateLimitHeaders(res, rateLimitState);

      if (req.method === "GET" && pathname === "/health") {
        sendJson(req, res, pathname, 200, {
          ok: true,
          service: "valik-ai-estimator-api",
        });
        return;
      }

      if (req.method === "GET" && pathname === "/metrics") {
        const output = metrics?.registry?.toPrometheus?.() ?? "";
        sendText(
          req,
          res,
          pathname,
          200,
          output,
          "text/plain; version=0.0.4; charset=utf-8",
        );
        return;
      }

      if (req.method === "POST" && pathname === "/api/chat/start") {
        const body = await readJsonBody(req);
        const message = String(body.message ?? "").trim();

        let session = await repository.createSession();
        if (!message) {
          sendJson(req, res, pathname, 200, {
            sessionId: session.sessionId,
            status: session.status,
            assistantMessage: agent.getInitialPrompt(),
            missingFields: DEFAULT_INITIAL_FIELDS,
            questions: [],
            works: session.works,
            warnings: session.warnings,
            estimate: session.estimate,
          });
          return;
        }

        enforceMessageSafety({
          req,
          message,
          sessionId: session.sessionId,
          pathname,
        });

        const processed = await agent.processMessage({ session, message });
        session = await repository.saveSession(processed.session);
        sendJson(req, res, pathname, 200, processed.response);
        return;
      }

      if (req.method === "POST" && pathname === "/api/chat/message") {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? "").trim();
        const message = String(body.message ?? "").trim();

        if (!sessionId) {
          throw new HttpError(400, "sessionId is required.");
        }

        if (!message) {
          throw new HttpError(400, "message is required.");
        }

        enforceMessageSafety({
          req,
          message,
          sessionId,
          pathname,
        });

        const session = await repository.getSession(sessionId);
        if (!session) {
          throw new HttpError(404, `Session ${sessionId} was not found.`);
        }

        const processed = await agent.processMessage({ session, message });
        await repository.saveSession(processed.session);
        sendJson(req, res, pathname, 200, processed.response);
        return;
      }

      const estimateSessionId = parseSessionIdFromEstimatePath(pathname);
      if (req.method === "GET" && estimateSessionId) {
        const session = await repository.getSession(estimateSessionId);
        if (!session) {
          throw new HttpError(404, `Session ${estimateSessionId} was not found.`);
        }

        sendJson(req, res, pathname, 200, {
          sessionId: session.sessionId,
          status: session.status,
          works: session.works,
          warnings: session.warnings,
          missingFields: session.missingFields,
          questions: session.questions,
          estimate: session.estimate,
          confirmedAt: session.confirmedAt,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/estimate/confirm") {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? "").trim();
        const sendToCrm = toBool(body.sendToCrm, false);

        if (!sessionId) {
          throw new HttpError(400, "sessionId is required.");
        }

        const session = await repository.getSession(sessionId);
        if (!session) {
          throw new HttpError(404, `Session ${sessionId} was not found.`);
        }

        const confirmation = agent.confirmSession(session);
        if (!confirmation.ok) {
          throw new HttpError(
            409,
            "Estimate is not ready for confirmation.",
            confirmation,
          );
        }

        const savedSession = await repository.saveSession(confirmation.session);
        const crmLead = buildCrmLeadDto(savedSession);
        let crmResult = {
          sent: false,
          mode: "not_requested",
        };
        let crmOutboxJob = null;

        if (sendToCrm) {
          const idempotencyKey = `confirm:${sessionId}`;
          crmOutboxJob = await deliveryOutbox.enqueueLead({
            sessionId,
            leadDto: crmLead,
            idempotencyKey,
          });

          if (crmOutboxJob.status === "sent") {
            crmResult = {
              status: "sent",
              reused: true,
              job: crmOutboxJob,
              delivery: crmOutboxJob.deliveryMeta,
            };
          } else if (crmOutboxJob.status === "failed") {
            crmResult = {
              status: "failed",
              reused: true,
              job: crmOutboxJob,
              error: crmOutboxJob.lastError,
            };
          } else {
            crmResult = await deliveryOutbox.processJob(crmOutboxJob.id);
          }
        }

        sendJson(req, res, pathname, 200, {
          sessionId: savedSession.sessionId,
          status: savedSession.status,
          alreadyConfirmed: Boolean(confirmation.alreadyConfirmed),
          transferPayload: confirmation.transferPayload,
          crmLead,
          crmOutboxJob,
          crmResult,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/integrations/crm/lead") {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? "").trim();
        const dryRun = toBool(body.dryRun, true);

        if (!sessionId) {
          throw new HttpError(400, "sessionId is required.");
        }

        const session = await repository.getSession(sessionId);
        if (!session) {
          throw new HttpError(404, `Session ${sessionId} was not found.`);
        }

        const crmLead = buildCrmLeadDto(session);
        let crmResult;
        let crmOutboxJob = null;

        if (dryRun) {
          try {
            crmResult = await crmClient.sendLead(crmLead, { dryRun: true });
          } catch (error) {
            throw new HttpError(502, error.message);
          }
        } else {
          crmOutboxJob = await deliveryOutbox.enqueueLead({
            sessionId,
            leadDto: crmLead,
          });
          crmResult = await deliveryOutbox.processJob(crmOutboxJob.id);
        }

        sendJson(req, res, pathname, 200, {
          sessionId,
          dryRun,
          crmLead,
          crmOutboxJob,
          crmResult,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/integrations/crm/outbox/process") {
        const body = await readJsonBody(req);
        const limit = parsePositiveInt(body.limit, 20);
        const summary = await deliveryOutbox.processPending({ limit });

        sendJson(req, res, pathname, 200, summary);
        return;
      }

      if (req.method === "GET" && pathname === "/api/integrations/crm/outbox") {
        const baseUrl = `http://${req.headers.host ?? "localhost"}`;
        const url = new URL(req.url ?? "/", baseUrl);
        const status = String(url.searchParams.get("status") ?? "").trim() || undefined;
        const limit = parsePositiveInt(url.searchParams.get("limit"), 50);

        const jobs = await deliveryOutbox.listJobs({ status, limit });
        sendJson(req, res, pathname, 200, { jobs, count: jobs.length });
        return;
      }

      if (req.method === "GET" && pathname === "/api/integrations/crm/outbox/dlq") {
        const baseUrl = `http://${req.headers.host ?? "localhost"}`;
        const url = new URL(req.url ?? "/", baseUrl);
        const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
        const jobs =
          typeof deliveryOutbox.listDeadLetterJobs === "function"
            ? await deliveryOutbox.listDeadLetterJobs({ limit })
            : await deliveryOutbox.listJobs({ status: "failed", limit });

        sendJson(req, res, pathname, 200, { jobs, count: jobs.length });
        return;
      }

      throw new HttpError(404, `Route not found: ${req.method} ${pathname}`);
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      const payload = {
        error: error.message || "Internal server error.",
      };

      if (error.details) {
        payload.details = error.details;
      }

      if (statusCode >= 500) {
        requestLogger.error?.("http_unhandled_error", {
          request_id: requestId,
          method,
          pathname,
          error: error.message ?? "Internal server error.",
          stack: error.stack,
        });
      }

      sendJson(req, res, pathname, statusCode, payload, error.headers, true);
    }
  });

  return {
    server,
    start(port = 3000) {
      return new Promise((resolve) => {
        server.listen(port, () => {
          const address = server.address();
          const actualPort =
            typeof address === "object" && address ? address.port : port;
          resolve(actualPort);
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          Promise.resolve()
            .then(async () => {
              if (typeof deliveryOutbox.close === "function") {
                await deliveryOutbox.close();
              }
              if (typeof repository.close === "function") {
                await repository.close();
              }
            })
            .then(resolve)
            .catch(reject);
        });
      });
    },
  };
}

export async function createDefaultApp() {
  dotenv.config();

  const logger = createLogger({
    service: "valik-ai-estimator-api",
    level: process.env.LOG_LEVEL ?? "info",
  });
  const metrics = createAppMetrics({
    prefix: process.env.METRICS_PREFIX ?? "valik",
  });

  const databasePath =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.sqlite");

  const repository = new SessionRepository({
    dbPath: databasePath,
    legacyFilePath: path.join(process.cwd(), "data", "sessions.json"),
  });
  await repository.init();
  const outboxRepository = new OutboxRepository({
    dbPath: databasePath,
    legacyFilePath: path.join(process.cwd(), "data", "crm-outbox.json"),
  });
  await outboxRepository.init();

  const agent = createChatAgent({
    extractWorks: createOpenAIExtractor(),
  });
  const crmClient = createCrmClient();
  const alertClient = createAlertClient();
  const outboxProcessor = new CrmOutboxProcessor({
    repository: outboxRepository,
    crmClient,
    maxAttempts: parsePositiveInt(process.env.OUTBOX_MAX_ATTEMPTS, 6),
    backoffBaseMs: parsePositiveInt(process.env.OUTBOX_BACKOFF_BASE_MS, 30_000),
    backoffMaxMs: parsePositiveInt(process.env.OUTBOX_BACKOFF_MAX_MS, 3_600_000),
    logger: logger.child({ component: "crm_outbox" }),
    metrics,
    alertHandler: alertClient.enabled
      ? async (eventPayload) => {
          await alertClient.sendEvent(eventPayload);
        }
      : null,
  });

  const app = createHttpApp({
    repository,
    agent,
    crmClient,
    outboxProcessor,
    security: buildSecurityConfig(),
    logger: logger.child({ component: "http" }),
    metrics,
  });

  const outboxIntervalMs = parsePositiveInt(
    process.env.OUTBOX_PROCESS_INTERVAL_MS,
    15_000,
  );
  const timer = setInterval(async () => {
    try {
      await outboxProcessor.processPending({ limit: 30 });
    } catch (error) {
      logger.error("crm_outbox_periodic_failed", {
        error: error.message,
      });
    }
  }, outboxIntervalMs);
  timer.unref?.();

  return {
    ...app,
    async start(port = 3000) {
      const actualPort = await app.start(port);
      logger.info("server_started", { port: actualPort });
      return actualPort;
    },
    async stop() {
      clearInterval(timer);
      await app.stop();
      logger.info("server_stopped");
    },
  };
}

const isExecutedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isExecutedDirectly) {
  createDefaultApp()
    .then((app) => app.start(Number(process.env.PORT ?? 3000)))
    .then((port) => {
      console.log(`API server is running on http://localhost:${port}`);
    })
    .catch((error) => {
      console.error("Failed to start API server:");
      console.error(error.message);
      process.exitCode = 1;
    });
}
