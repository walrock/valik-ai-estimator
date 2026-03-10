import dotenv from "dotenv";
import { evaluateRuntimeConfig, formatPreflightReport } from "../infra/preflight.js";

dotenv.config();

const report = await evaluateRuntimeConfig();
process.stdout.write(formatPreflightReport(report));

if (!report.ok) {
  process.exitCode = 1;
}
