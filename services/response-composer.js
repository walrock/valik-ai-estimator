import OpenAI from "openai";
import { normalizeChatLanguage } from "../engine/language.js";

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function trimToLength(text, limit) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function createOpenAIResponseComposer({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.ASSISTANT_TEXT_MODEL ?? "gpt-4o-mini",
  enabled = toBoolean(process.env.AI_ASSISTANT_COPY, true),
  maxChars = parsePositiveInt(process.env.ASSISTANT_TEXT_MAX_CHARS, 600),
} = {}) {
  if (!enabled) {
    return null;
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const openai = new OpenAI({ apiKey });

  return async function composeAssistantMessage({
    language,
    status,
    questions,
    missingFields,
    fallbackMessage,
    latestUserMessage,
    estimate,
  }) {
    const safeLanguage = normalizeChatLanguage(language, "pl");

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: [
            "You write customer-facing messages for a renovation estimate assistant.",
            "Return plain text only.",
            "Use the requested language code exactly: pl, en or ru.",
            "Keep message concise and natural (1-4 short lines).",
            "Do not change facts, numbers, status, or required questions.",
            "If status is ready_for_confirmation, ask for confirmation.",
            "If status is needs_clarification, ask only for missing details.",
            "If status is active, ask for project scope details.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            language: safeLanguage,
            status,
            questions: Array.isArray(questions) ? questions : [],
            missingFields: Array.isArray(missingFields) ? missingFields : [],
            latestUserMessage: String(latestUserMessage ?? ""),
            estimate: estimate
              ? {
                  subtotal: estimate.subtotal,
                  total: estimate.total,
                }
              : null,
            fallbackMessage: String(fallbackMessage ?? ""),
          }),
        },
      ],
    });

    const text = String(response.choices[0]?.message?.content ?? "").trim();
    if (!text) {
      return String(fallbackMessage ?? "");
    }

    return trimToLength(text, maxChars);
  };
}
