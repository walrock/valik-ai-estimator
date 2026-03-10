import dotenv from "dotenv";
import { formatSmokeReport, runStagingSmoke } from "../infra/staging-smoke.js";

dotenv.config();

try {
  const report = await runStagingSmoke({
    baseUrl: process.env.SMOKE_BASE_URL,
    apiKey: process.env.SMOKE_API_KEY ?? null,
    adminApiKey: process.env.SMOKE_ADMIN_API_KEY ?? null,
    metricsApiKey: process.env.SMOKE_METRICS_API_KEY ?? null,
    sendToCrm: process.env.SMOKE_SEND_TO_CRM ?? false,
    strictMetrics: process.env.SMOKE_STRICT_METRICS ?? false,
    startMessage: process.env.SMOKE_START_MESSAGE,
    followupMessage: process.env.SMOKE_FOLLOWUP_MESSAGE,
  });

  process.stdout.write(formatSmokeReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`Smoke runner failed: ${error.message}\n`);
  process.exitCode = 1;
}
