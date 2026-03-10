import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmLeadDto } from "../dto/crm.js";

test("CRM DTO builder maps session payload to strict contract", () => {
  const dto = buildCrmLeadDto({
    sessionId: "session-1",
    createdAt: "2026-03-10T10:00:00.000Z",
    confirmedAt: "2026-03-10T10:10:00.000Z",
    status: "confirmed",
    userMessages: ["Bathroom 6m2 in Warsaw", "Start next week"],
    warnings: [],
    missingFields: [],
    estimate: {
      subtotal: 1650,
      total: 1650,
      warnings: [],
      appliedRules: [],
      breakdown: [
        {
          name: "tile_60_120",
          quantity: 6,
          unit: "m2",
          unitPrice: 175,
          total: 1050,
        },
      ],
    },
  });

  assert.equal(dto.source, "valik-ai-estimator");
  assert.equal(dto.customer.city, "Warsaw");
  assert.equal(dto.customer.timeline, "next week");
  assert.equal(dto.estimate.currency, "PLN");
  assert.equal(dto.estimate.total, 1650);
});
