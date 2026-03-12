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

  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

const CONFIRM_BUTTON_LABEL = Object.freeze({
  pl: "Potwierdz wycene",
  en: "Confirm estimate",
  ru: "Подтвердить смету",
});

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
    offTopic = false,
  }) {
    const safeLanguage = normalizeChatLanguage(language, "pl");
    const confirmButtonLabel =
      CONFIRM_BUTTON_LABEL[safeLanguage] ?? CONFIRM_BUTTON_LABEL.pl;
    const latestText = String(latestUserMessage ?? "");
    const userAskedQuestion = /[?？]/u.test(latestText);
    const mustCollectDetails =
      offTopic || (Array.isArray(missingFields) && missingFields.length > 0);

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: [
            "You write customer-facing messages for a renovation estimate assistant.",
            "Return plain text only.",
            "Use the requested language code exactly: pl, en or ru.",
            "Tone: warm, professional, consultative, conversion-focused.",
            "Keep message concise and natural (2-8 short lines).",
            "Prefer natural conversational phrasing, not robotic templates.",
            "Do not change facts, numbers, status, or required questions.",
            "Do not invent services, discounts, guarantees, deadlines, or prices.",
            "Start with a short direct answer to the latest user message.",
            "If offTopic is true, clearly say this chat handles only renovation estimate topics and redirect user to estimate details.",
            "If the user asks something outside available facts but still related to estimate, say a manager will clarify it after confirmation.",
            "When mustCollectDetails is true, always end with a data request block and include the provided questions as bullet points.",
            "Use each question from the provided questions list exactly, do not rewrite them.",
            "If status is ready_for_confirmation, ask for confirmation.",
            "If status is ready_for_confirmation, also invite user to leave a message or phone number for follow-up questions.",
            "If status is needs_clarification, ask only for missing details.",
            "If status is active, ask for project scope details.",
            "If status is ready_for_confirmation, include explicit CTA with provided confirm button label.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            language: safeLanguage,
            status,
            questions: Array.isArray(questions) ? questions : [],
            missingFields: Array.isArray(missingFields) ? missingFields : [],
            latestUserMessage: latestText,
            userAskedQuestion,
            offTopic,
            mustCollectDetails,
            estimate: estimate
              ? {
                  subtotal: estimate.subtotal,
                  total: estimate.total,
                }
              : null,
            knownFacts: [
              "This is a draft estimate based on described works and quantities.",
              "Final total may be adjusted after full project details and manager review.",
              "Confirmation button sends the draft and contact context to a manager.",
              "Service scope: renovation and finishing works for properties.",
            ],
            ui: {
              confirmButtonLabel,
            },
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
