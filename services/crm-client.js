export function createCrmClient({
  webhookUrl = process.env.CRM_WEBHOOK_URL,
  apiKey = process.env.CRM_API_KEY,
} = {}) {
  return {
    async sendLead(leadDto, { dryRun = false } = {}) {
      if (dryRun || !webhookUrl) {
        return {
          sent: false,
          mode: dryRun ? "dry_run" : "not_configured",
          webhookUrl: webhookUrl ?? null,
        };
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(leadDto),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `CRM webhook failed with status ${response.status}: ${body.slice(0, 300)}`,
        );
      }

      return {
        sent: true,
        mode: "webhook",
        webhookUrl,
        statusCode: response.status,
      };
    },
  };
}
