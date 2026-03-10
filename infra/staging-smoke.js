function toBool(value, fallback = false) {
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

function toHeaders({ apiKey, contentType = null } = {}) {
  const headers = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  return headers;
}

async function parseJsonSafely(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function fetchJson({ url, method = "GET", headers = {}, body = undefined }) {
  const response = await fetch(url, {
    method,
    headers,
    body,
  });
  const text = await response.text();
  const json = await parseJsonSafely(text);

  return { response, text, json };
}

function pushResult(results, { step, status, detail }) {
  results.push({ step, status, detail });
}

export async function runStagingSmoke({
  baseUrl,
  apiKey = null,
  adminApiKey = null,
  metricsApiKey = null,
  sendToCrm = false,
  strictMetrics = false,
  startMessage = "Bathroom 6m2, remove old tiles, prime and paint.",
  followupMessage = "Warsaw, next week, 3 floor, with lift.",
} = {}) {
  const normalizedBaseUrl = String(baseUrl ?? "").replace(/\/+$/, "");
  if (!normalizedBaseUrl) {
    throw new Error("baseUrl is required.");
  }

  const results = [];
  let sessionId = null;

  try {
    {
      const { response, json } = await fetchJson({
        url: `${normalizedBaseUrl}/health`,
      });
      if (response.status !== 200 || !json?.ok) {
        throw new Error(`/health returned ${response.status}`);
      }
      pushResult(results, {
        step: "health",
        status: "passed",
        detail: `status=${response.status}`,
      });
    }

    {
      const { response, json } = await fetchJson({
        url: `${normalizedBaseUrl}/api/chat/start`,
        method: "POST",
        headers: toHeaders({ apiKey, contentType: "application/json" }),
        body: JSON.stringify({ message: startMessage }),
      });
      if (response.status !== 200 || !json?.sessionId) {
        throw new Error(`/api/chat/start returned ${response.status}`);
      }
      sessionId = json.sessionId;
      pushResult(results, {
        step: "chat_start",
        status: "passed",
        detail: `sessionId=${sessionId}`,
      });
    }

    {
      const { response } = await fetchJson({
        url: `${normalizedBaseUrl}/api/chat/message`,
        method: "POST",
        headers: toHeaders({ apiKey, contentType: "application/json" }),
        body: JSON.stringify({
          sessionId,
          message: followupMessage,
        }),
      });
      if (response.status !== 200) {
        throw new Error(`/api/chat/message returned ${response.status}`);
      }
      pushResult(results, {
        step: "chat_message",
        status: "passed",
        detail: `status=${response.status}`,
      });
    }

    {
      const { response } = await fetchJson({
        url: `${normalizedBaseUrl}/api/estimate/${encodeURIComponent(sessionId)}`,
        headers: toHeaders({ apiKey }),
      });
      if (response.status !== 200) {
        throw new Error(`/api/estimate/:id returned ${response.status}`);
      }
      pushResult(results, {
        step: "estimate_get",
        status: "passed",
        detail: `status=${response.status}`,
      });
    }

    {
      const { response } = await fetchJson({
        url: `${normalizedBaseUrl}/api/estimate/confirm`,
        method: "POST",
        headers: toHeaders({ apiKey, contentType: "application/json" }),
        body: JSON.stringify({ sessionId, sendToCrm: toBool(sendToCrm, false) }),
      });
      if (response.status !== 200) {
        throw new Error(`/api/estimate/confirm returned ${response.status}`);
      }
      pushResult(results, {
        step: "estimate_confirm",
        status: "passed",
        detail: `status=${response.status} sendToCrm=${toBool(sendToCrm, false)}`,
      });
    }

    {
      const { response } = await fetchJson({
        url: `${normalizedBaseUrl}/api/integrations/crm/lead`,
        method: "POST",
        headers: toHeaders({ apiKey, contentType: "application/json" }),
        body: JSON.stringify({ sessionId, dryRun: true }),
      });
      if (response.status !== 200) {
        throw new Error(`/api/integrations/crm/lead returned ${response.status}`);
      }
      pushResult(results, {
        step: "crm_dry_run",
        status: "passed",
        detail: `status=${response.status}`,
      });
    }

    if (metricsApiKey || strictMetrics) {
      const { response, text } = await fetchJson({
        url: `${normalizedBaseUrl}/metrics`,
        headers: toHeaders({ apiKey: metricsApiKey }),
      });
      if (response.status !== 200) {
        throw new Error(`/metrics returned ${response.status}`);
      }
      if (!String(text).includes("_http_requests_total")) {
        throw new Error("/metrics does not contain *_http_requests_total");
      }
      pushResult(results, {
        step: "metrics",
        status: "passed",
        detail: `status=${response.status}`,
      });
    } else {
      pushResult(results, {
        step: "metrics",
        status: "skipped",
        detail: "metricsApiKey is not provided and strictMetrics=false",
      });
    }

    if (adminApiKey) {
      const adminHeaders = toHeaders({ apiKey: adminApiKey });

      {
        const { response } = await fetchJson({
          url: `${normalizedBaseUrl}/api/integrations/crm/outbox?limit=10`,
          headers: adminHeaders,
        });
        if (response.status !== 200) {
          throw new Error(`/api/integrations/crm/outbox returned ${response.status}`);
        }
      }

      {
        const { response } = await fetchJson({
          url: `${normalizedBaseUrl}/api/integrations/crm/outbox/dlq?limit=10`,
          headers: adminHeaders,
        });
        if (response.status !== 200) {
          throw new Error(`/api/integrations/crm/outbox/dlq returned ${response.status}`);
        }
      }

      {
        const { response } = await fetchJson({
          url: `${normalizedBaseUrl}/api/integrations/crm/outbox/process`,
          method: "POST",
          headers: toHeaders({ apiKey: adminApiKey, contentType: "application/json" }),
          body: JSON.stringify({ limit: 10 }),
        });
        if (response.status !== 200) {
          throw new Error(`/api/integrations/crm/outbox/process returned ${response.status}`);
        }
      }

      pushResult(results, {
        step: "outbox_admin",
        status: "passed",
        detail: "outbox, dlq and process endpoints are reachable",
      });
    } else {
      pushResult(results, {
        step: "outbox_admin",
        status: "skipped",
        detail: "adminApiKey is not provided",
      });
    }
  } catch (error) {
    pushResult(results, {
      step: "failure",
      status: "failed",
      detail: error.message,
    });
    return {
      ok: false,
      sessionId,
      results,
    };
  }

  return {
    ok: true,
    sessionId,
    results,
  };
}

export function formatSmokeReport(report) {
  const lines = [];
  lines.push(`Staging smoke status: ${report.ok ? "OK" : "FAILED"}`);
  if (report.sessionId) {
    lines.push(`Session ID: ${report.sessionId}`);
  }
  lines.push("");
  report.results.forEach((item) => {
    lines.push(`- [${item.status}] ${item.step}: ${item.detail}`);
  });

  return `${lines.join("\n")}\n`;
}
