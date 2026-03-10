import OpenAI from "openai";
import dotenv from "dotenv";
import { calculateProject } from "./engine/calculator.js";
import { buildExtractionPrompt } from "./engine/prompt.js";
import { normalizeWorks } from "./engine/normalizer.js";
import { resolveWorkQuantities } from "./engine/quantity.js";
import {
  buildClarifyingQuestions,
  detectMissingFields,
} from "./engine/clarifier.js";
import { RawExtractionSchema } from "./domain/schemas.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeMessage(message) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: buildExtractionPrompt(),
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0,
  });

  return response.choices[0].message.content ?? "";
}

function parseExtraction(rawContent) {
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (error) {
    return {
      works: [],
      warnings: ["Model response is not valid JSON."],
    };
  }

  const parsed = RawExtractionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      works: [],
      warnings: ["Model JSON does not match expected schema."],
    };
  }

  return {
    works: parsed.data.works,
    warnings: [],
  };
}

async function run() {
  const testMessage =
    "Bathroom 6m2, remove old tile without lift, tile 60x60, primer + paint in 2 layers.";

  const modelOutput = await analyzeMessage(testMessage);
  const extracted = parseExtraction(modelOutput);
  const normalized = normalizeWorks(extracted.works);
  const quantityResolved = resolveWorkQuantities({
    works: normalized.works,
    unresolvedQuantity: normalized.unresolvedQuantity,
    message: testMessage,
  });
  const calculation = calculateProject(quantityResolved.works);
  const missingFields = detectMissingFields({
    message: testMessage,
    works: quantityResolved.works,
  });
  const questions = buildClarifyingQuestions(missingFields);

  const warnings = [
    ...extracted.warnings,
    ...normalized.warnings,
    ...quantityResolved.warnings,
    ...calculation.warnings,
  ];

  console.log("NORMALIZED WORKS:", normalized.works);
  console.log("QUANTITY RESOLVED WORKS:", quantityResolved.works);
  console.log("QUANTITY HINTS:", quantityResolved.quantityHints);
  console.log("WARNINGS:", warnings);
  console.log("MISSING FIELDS:", missingFields);
  console.log("QUESTIONS:", questions);
  console.log("BREAKDOWN:", calculation.breakdown);
  console.log("SUBTOTAL:", calculation.subtotal, "PLN");
  console.log("TOTAL:", calculation.total, "PLN");
}

run().catch((error) => {
  console.error("Execution failed:");
  console.error(error.message);
});
