import { pricing } from "../config/pricing.js";
import { WorkItemSchema } from "../domain/schemas.js";

function flattenSchemaErrors(error) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "item"}: ${issue.message}`)
    .join("; ");
}

export function calculateProject(works) {
  let subtotal = 0;
  const breakdown = [];
  const warnings = [];

  (works ?? []).forEach((candidate, index) => {
    const parsed = WorkItemSchema.safeParse(candidate);
    if (!parsed.success) {
      warnings.push(
        `works[${index}] skipped: ${flattenSchemaErrors(parsed.error)}`,
      );
      return;
    }

    const work = parsed.data;
    const item = pricing[work.category][work.type];
    const lineTotal = Number((item.price * work.quantity).toFixed(2));

    breakdown.push({
      name: work.type,
      quantity: work.quantity,
      unit: item.unit,
      unitPrice: item.price,
      total: lineTotal,
    });

    subtotal += lineTotal;
  });

  subtotal = Number(subtotal.toFixed(2));
  const appliedRules = [];
  const total = subtotal;

  return { subtotal, total, breakdown, warnings, appliedRules };
}
