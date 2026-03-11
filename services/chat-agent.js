import { buildClarifyingQuestions, detectMissingFields } from "../engine/clarifier.js";
import { calculateProject } from "../engine/calculator.js";
import { detectChatLanguage, normalizeChatLanguage } from "../engine/language.js";
import { normalizeWorks } from "../engine/normalizer.js";
import { resolveWorkQuantities } from "../engine/quantity.js";
import { mergeWorkLists } from "../engine/works.js";
import { ChatStateSchema } from "../domain/schemas.js";

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

const PROMPTS = Object.freeze({
  pl: Object.freeze({
    initial:
      "Opisz zakres prac, powierzchnie/ilosci, miasto i preferowany termin realizacji.",
    ready:
      "Wstepna wycena jest gotowa. Jesli wszystko sie zgadza, kliknij \"Potwierdz wycene\", a przekaze dane do opiekuna.",
    clarifying:
      "Super, zeby przygotowac dokladna wycene, potrzebuje jeszcze kilku informacji:",
    generic:
      "Podaj prosze troche wiecej szczegolow o zakresie prac i ilosciach, a przygotuje dokladniejsza wycene.",
  }),
  en: Object.freeze({
    initial:
      "Describe required works, area/quantity, city and preferred timeline.",
    ready:
      "The draft estimate is ready. If everything looks good, click \"Confirm estimate\" and I will pass it to a manager.",
    clarifying:
      "Great, I need a few more details to complete an accurate estimate:",
    generic:
      "Please share a few more details about works and quantities, and I will prepare a more accurate estimate.",
  }),
  ru: Object.freeze({
    initial: "Опишите работы, площадь/количество, город и желаемые сроки.",
    ready:
      "Черновая смета готова. Если все верно, нажмите \"Подтвердить смету\", и я передам данные менеджеру.",
    clarifying:
      "Отлично, чтобы подготовить точную смету, мне нужно еще несколько деталей:",
    generic:
      "Пожалуйста, уточните работы и объемы, и я подготовлю более точную смету.",
  }),
});

function getLanguagePack(language) {
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  return PROMPTS[normalizedLanguage] ?? PROMPTS.pl;
}

function ensureSessionShape(session) {
  const parsed = ChatStateSchema.safeParse(session);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt ?? nowIso(),
    updatedAt: session.updatedAt ?? nowIso(),
    confirmedAt: session.confirmedAt ?? null,
    status: "active",
    works: Array.isArray(session.works) ? session.works : [],
    missingFields: [],
    lastUserMessage: "",
    userMessages: [],
    warnings: [],
    estimate: null,
    questions: [],
    language: "pl",
  };
}

function buildTemplateReply(status, questions, language) {
  const pack = getLanguagePack(language);

  if (status === "ready_for_confirmation") {
    return pack.ready;
  }

  if (questions.length > 0) {
    return `${pack.clarifying}\n- ${questions.join("\n- ")}`;
  }

  return pack.generic;
}

async function buildAssistantMessage({
  composeAssistantMessage,
  language,
  status,
  questions,
  missingFields,
  latestUserMessage,
  estimate,
}) {
  const fallbackMessage = buildTemplateReply(status, questions, language);

  if (typeof composeAssistantMessage !== "function") {
    return fallbackMessage;
  }

  try {
    const generated = await composeAssistantMessage({
      language,
      status,
      questions,
      missingFields,
      fallbackMessage,
      latestUserMessage,
      estimate,
    });

    const normalized = String(generated ?? "").trim();
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    // Use deterministic fallback if AI phrasing fails.
  }

  return fallbackMessage;
}

function buildTransferPayload(session) {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    confirmedAt: session.confirmedAt,
    status: session.status,
    works: session.works,
    estimate: session.estimate,
    warnings: session.warnings,
    transcript: session.userMessages,
    language: session.language,
  };
}

export function createChatAgent({ extractWorks, composeAssistantMessage = null }) {
  if (typeof extractWorks !== "function") {
    throw new Error("extractWorks handler is required.");
  }

  return {
    getInitialPrompt({ language = "pl" } = {}) {
      return getLanguagePack(language).initial;
    },

    async processMessage({ session, message }) {
      const safeSession = ensureSessionShape(session);
      const cleanedMessage = String(message ?? "").trim();

      if (!cleanedMessage) {
        throw new Error("Message is required.");
      }

      const detectedLanguage = detectChatLanguage(cleanedMessage);
      const language = normalizeChatLanguage(
        detectedLanguage ?? safeSession.language,
        "pl",
      );

      const extraction = await extractWorks(cleanedMessage);
      const normalized = normalizeWorks(extraction.works);
      const quantityResolved = resolveWorkQuantities({
        works: normalized.works,
        unresolvedQuantity: normalized.unresolvedQuantity,
        message: cleanedMessage,
      });

      const works = mergeWorkLists(safeSession.works, quantityResolved.works);
      const userMessages = [...safeSession.userMessages, cleanedMessage];
      const conversationText = userMessages.join("\n");
      const estimate = calculateProject(works);
      const missingFields = detectMissingFields({
        message: conversationText,
        works,
      });
      const questions = buildClarifyingQuestions(missingFields, { language });

      const warnings = uniqueStrings([
        ...safeSession.warnings,
        ...extraction.warnings,
        ...normalized.warnings,
        ...quantityResolved.warnings,
        ...estimate.warnings,
      ]);

      const status =
        missingFields.length === 0 ? "ready_for_confirmation" : "needs_clarification";

      const assistantMessage = await buildAssistantMessage({
        composeAssistantMessage,
        language,
        status,
        questions,
        missingFields,
        latestUserMessage: cleanedMessage,
        estimate,
      });

      const updatedSession = {
        ...safeSession,
        updatedAt: nowIso(),
        status,
        works,
        estimate,
        missingFields,
        questions,
        warnings,
        userMessages,
        lastUserMessage: cleanedMessage,
        language,
      };

      return {
        session: updatedSession,
        response: {
          sessionId: updatedSession.sessionId,
          status,
          assistantMessage,
          questions,
          missingFields,
          warnings,
          works,
          estimate,
          language,
        },
      };
    },

    confirmSession(session) {
      const safeSession = ensureSessionShape(session);

      if (safeSession.status === "confirmed" && safeSession.confirmedAt) {
        return {
          ok: true,
          alreadyConfirmed: true,
          session: safeSession,
          transferPayload: buildTransferPayload(safeSession),
        };
      }

      if (safeSession.missingFields.length > 0) {
        return {
          ok: false,
          reason: "missing_fields",
          missingFields: safeSession.missingFields,
          questions: safeSession.questions,
        };
      }

      const confirmedAt = nowIso();
      const finalizedSession = {
        ...safeSession,
        status: "confirmed",
        updatedAt: confirmedAt,
        confirmedAt,
      };

      return {
        ok: true,
        alreadyConfirmed: false,
        session: finalizedSession,
        transferPayload: buildTransferPayload(finalizedSession),
      };
    },
  };
}
