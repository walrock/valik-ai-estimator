import { z } from "zod";
import { WORK_CATEGORIES, WORK_TYPES_BY_CATEGORY } from "./catalog.js";

if (WORK_CATEGORIES.length === 0) {
  throw new Error("Pricing catalog is empty. At least one category is required.");
}

const quantitySchema = z.coerce.number().finite().positive();

export const RawWorkItemSchema = z.object({
  category: z.string().trim().min(1),
  type: z.string().trim().min(1),
  quantity: z.union([z.number(), z.string(), z.null()]).optional(),
});

export const RawExtractionSchema = z.object({
  works: z.array(RawWorkItemSchema).default([]),
});

const strictWorkVariants = WORK_CATEGORIES.map((category) => {
  const workTypes = WORK_TYPES_BY_CATEGORY[category];

  if (workTypes.length === 0) {
    throw new Error(`Category "${category}" has no work types in pricing config.`);
  }

  return z.object({
    category: z.literal(category),
    type: z.enum(workTypes),
    quantity: quantitySchema,
  });
});

export const WorkItemSchema = z.discriminatedUnion("category", strictWorkVariants);

export const EstimateDraftSchema = z.object({
  works: z.array(WorkItemSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

const BreakdownItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const CalculationSchema = z.object({
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  breakdown: z.array(BreakdownItemSchema),
  warnings: z.array(z.string()).default([]),
  appliedRules: z.array(z.string()).default([]),
});

export const ChatStateSchema = z.object({
  sessionId: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["active", "needs_clarification", "ready_for_confirmation", "confirmed"]),
  language: z.enum(["pl", "en", "ru"]).default("pl"),
  works: z.array(WorkItemSchema).default([]),
  missingFields: z.array(z.string()).default([]),
  lastUserMessage: z.string().default(""),
  userMessages: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  estimate: CalculationSchema.nullable().default(null),
  confirmedAt: z.string().datetime().nullable().default(null),
});
