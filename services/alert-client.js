import { buildAlertSignatureHeader } from "../security/alert-signature.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function createAlertClient({
  webhookUrl = process.env.ALERT_WEBHOOK_URL,
  apiKey = process.env.ALERT_API_KEY,
  signingSecret = process.env.ALERT_SIGNING_SECRET,
  timeoutMs = parsePositiveInt(process.env.ALERT_TIMEOUT_MS, 5000),
} = {}) {
  const isEnabled = typeof webhookUrl === "string" && webhookUrl.trim().length > 0;

  return {
    enabled: isEnabled,

    async sendEvent(eventPayload) {
      if (!isEnabled) {
        return {
          sent: false,
          mode: "not_configured",
          webhookUrl: null,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const payloadText = JSON.stringify(eventPayload);
      const timestamp = String(Math.floor(Date.now() / 1000));

      const signatureHeaders = {};
      if (typeof signingSecret === "string" && signingSecret.length > 0) {
        signatureHeaders["X-Alert-Timestamp"] = timestamp;
        signatureHeaders["X-Alert-Signature"] = buildAlertSignatureHeader({
          signingSecret,
          timestamp,
          payloadText,
        });
      }

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...signatureHeaders,
          },
          body: payloadText,
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Alert webhook failed with status ${response.status}: ${body.slice(0, 300)}`,
          );
        }

        return {
          sent: true,
          mode: "webhook",
          webhookUrl,
          statusCode: response.status,
        };
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error(`Alert webhook timed out after ${timeoutMs}ms`);
        }

        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
