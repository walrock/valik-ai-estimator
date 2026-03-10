import { z } from "zod";

const BreakdownItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const CrmLeadSchema = z.object({
  source: z.literal("valik-ai-estimator"),
  sessionId: z.string().min(1),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  status: z.enum(["active", "needs_clarification", "ready_for_confirmation", "confirmed"]),
  customer: z.object({
    city: z.string().nullable(),
    timeline: z.string().nullable(),
  }),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  transcript: z.array(z.string()),
  estimate: z.object({
    currency: z.literal("PLN"),
    subtotal: z.number().nonnegative(),
    total: z.number().nonnegative(),
    appliedRules: z.array(z.string()),
    warnings: z.array(z.string()),
    breakdown: z.array(BreakdownItemSchema),
  }),
});

const CITY_PATTERN =
  /\b(warsaw|krakow|wroclaw|gdansk|poznan|lodz|berlin|munich|london|paris)\b/i;
const TIMELINE_PATTERN =
  /\b(asap|urgent|tomorrow|next week|next month|\d+\s*(day|days|week|weeks|month|months))\b/i;

function extractCity(messages) {
  for (const message of messages) {
    const match = message.match(CITY_PATTERN);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractTimeline(messages) {
  for (const message of messages) {
    const match = message.match(TIMELINE_PATTERN);
    if (match) {
      return match[0];
    }
  }

  return null;
}

export function buildCrmLeadDto(session) {
  const transcript = Array.isArray(session.userMessages) ? session.userMessages : [];
  const estimate = session.estimate ?? {
    subtotal: 0,
    total: 0,
    appliedRules: [],
    warnings: [],
    breakdown: [],
  };

  const payload = {
    source: "valik-ai-estimator",
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    confirmedAt: session.confirmedAt ?? null,
    status: session.status,
    customer: {
      city: extractCity(transcript),
      timeline: extractTimeline(transcript),
    },
    missingFields: session.missingFields ?? [],
    warnings: session.warnings ?? [],
    transcript,
    estimate: {
      currency: "PLN",
      subtotal: estimate.subtotal ?? 0,
      total: estimate.total ?? 0,
      appliedRules: estimate.appliedRules ?? [],
      warnings: estimate.warnings ?? [],
      breakdown: estimate.breakdown ?? [],
    },
  };

  return CrmLeadSchema.parse(payload);
}
