import OpenAI from "openai";
import { buildExtractionPrompt } from "../engine/prompt.js";
import { RawExtractionSchema } from "../domain/schemas.js";

function parseExtractionPayload(rawPayload) {
  let parsedJson = rawPayload;

  if (typeof rawPayload === "string") {
    try {
      parsedJson = JSON.parse(rawPayload);
    } catch (error) {
      return {
        works: [],
        warnings: ["Model response is not valid JSON."],
      };
    }
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

export function createOpenAIExtractor({
  apiKey = process.env.OPENAI_API_KEY,
  model = "gpt-4o-mini",
} = {}) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const openai = new OpenAI({ apiKey });

  return async function extractWorks(message) {
    const response = await openai.chat.completions.create({
      model,
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

    const content = response.choices[0]?.message?.content ?? "";
    return parseExtractionPayload(content);
  };
}

export function createStaticExtractor(handler) {
  return async function extractWorks(message) {
    const output = await handler(message);
    return parseExtractionPayload(output);
  };
}
