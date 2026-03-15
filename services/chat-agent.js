import { buildClarifyingQuestions, detectMissingFields } from "../engine/clarifier.js";
import { calculateProject } from "../engine/calculator.js";
import { pruneImplicitWorks } from "../engine/extraction-scope.js";
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
      "Opisz zakres prac oraz powierzchnie/ilosci.",
    ready:
      "Wstepna wycena jest gotowa. Jesli wszystko sie zgadza, kliknij \"Potwierdz wycene\" - przekaze dane opiekunowi. Jesli chcesz, zostaw telefon lub e-mail, a oddzwonimy.",
    contact:
      "Dziekuje! Kontakt zapisany. Kliknij \"Potwierdz wycene\", a opiekun sie odezwie.",
    confirmed:
      "Wycena jest juz potwierdzona i przekazana do opiekuna. Jesli potrzebujesz nowej wyceny, rozpocznij nowa rozmowe.",
    clarifying:
      "Zeby przygotowac wycene, potrzebuje jeszcze kilku informacji:",
    generic:
      "Podaj prosze wiecej szczegolow o zakresie prac i ilosciach, a przygotuje wycene.",
  }),
  en: Object.freeze({
    initial:
      "Describe required works and area/quantity.",
    ready:
      "The draft estimate is ready. If everything looks good, click \"Confirm estimate\" - I will pass it to a manager. If you want a callback, leave a phone number or email.",
    contact:
      "Thanks! Contact saved. Click \"Confirm estimate\" and a manager will reach out.",
    confirmed:
      "This estimate is already confirmed and handed over to a manager. To prepare a new one, please start a new chat.",
    clarifying:
      "I need a few more details to complete the estimate:",
    generic:
      "Please share a few more details about works and quantities, and I will prepare the estimate.",
  }),
  ru: Object.freeze({
    initial: "Опишите работы и площадь/количество.",
    ready:
      "Черновая смета готова. Если все верно, нажмите \"Подтвердить смету\" - я передам данные менеджеру. Хотите, чтобы мы связались? Оставьте телефон или email.",
    contact:
      "Спасибо! Контакт записан. Нажмите \"Подтвердить смету\", и менеджер свяжется с вами.",
    confirmed:
      "Эта смета уже подтверждена и передана менеджеру. Чтобы сделать новую смету, начните новый диалог.",
    clarifying:
      "Чтобы подготовить смету, мне нужно еще несколько деталей:",
    generic:
      "Пожалуйста, уточните работы и объемы, и я подготовлю смету.",
  }),
});

const SALES_STYLE = Object.freeze({
  pl: Object.freeze({
    confirmButtonLabel: "Potwierdz wycene",
    confirmCta:
      'Jesli wszystko sie zgadza, kliknij "Potwierdz wycene", a przekaze dane do opiekuna. Jesli chcesz, zostaw telefon lub e-mail, a oddzwonimy.',
    contactHint:
      "Jesli chcesz, zostaw telefon lub e-mail, a oddzwonimy.",
  }),
  en: Object.freeze({
    confirmButtonLabel: "Confirm estimate",
    confirmCta:
      'If everything looks good, click "Confirm estimate" and I will pass it to a manager. If you want a callback, leave a phone number or email.',
    contactHint:
      "If you want a callback, leave a phone number or email.",
  }),
  ru: Object.freeze({
    confirmButtonLabel: "Подтвердить смету",
    confirmCta:
      'Если все верно, нажмите "Подтвердить смету", и я передам данные менеджеру. Хотите, чтобы мы связались? Оставьте телефон или email.',
    contactHint:
      "Хотите, чтобы мы связались? Оставьте телефон или email.",
  }),
});

const QUESTION_PATTERN = /[?？]/u;
const QUESTION_WORD_PATTERN =
  /(?:\b(?:who|what|when|where|why|how|can|could|do|does|is|are)\b|\b(?:co|jak|kiedy|gdzie|dlaczego|czy|mozna|można)\b|\b(?:что|как|когда|где|почему|можно|можете|умеете|делаете|какой|какие)\b)/iu;
const GREETING_PATTERN =
  /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|cze(?:s|ś)c|hej|dzien dobry|dzień dobry|witam|привет|здравствуй(?:те)?|добрый (?:день|вечер))[!.,\s?]*$/iu;
const AREA_OR_QUANTITY_SIGNAL_PATTERN =
  /\d+(?:[.,]\d+)?\s*(?:m2|m\^2|m²|sqm|sq\.?\s*m|кв\.?\s*м|квм|szt|szt\.|pcs?|шт)\b/iu;
const PROJECT_SCOPE_SIGNAL_PATTERN =
  /(?:estimate|quotation|quote|pricing|price|cost|paint|painting|plaster|tile|tiling|wall|walls|ceiling|floor|room|apartment|flat|house|renovat|remodel|repair|city|malow|farb|szpachl|gips|tynk|plytk|płytk|scian|ścian|sufit|podlog|podłog|remont|wycen|koszt|miast|mieszkan|łazien|lazien|kuchni|pokoj|покрас|краск|шпакл|штукатур|плитк|стен|потол|пол|ремонт|смет|оценк|стоимост|город|объект|квартир|дом|ванн|кухн)/iu;
const PRICE_QUESTION_PATTERN =
  /(?:\bprice\b|\bcost\b|\bcena\b|\bkoszt\b|wycen|цен|стоим|сколько)/i;
const PROCESS_QUESTION_PATTERN =
  /(?:what next|how (?:it )?works|after confirmation|co dalej|jak to dzia(?:ł|l)a|po potwierdzeniu|как это работает|что дальше|после подтверж)/i;
const LANGUAGE_QUESTION_PATTERN =
  /(?:language|english|polish|russian|język|po polsku|по-рус|на каком языке)/i;
const SCOPE_QUESTION_PATTERN =
  /(?:car|cars|automotive|машин|авто|samochod|samochody)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/g;

const QUESTION_ANSWERS = Object.freeze({
  pl: Object.freeze({
    price:
      "Cene liczymy na podstawie zakresu prac i ilosci, a finalna kwote potwierdza opiekun.",
    process:
      "Po potwierdzeniu przekazuje wycene do opiekuna, ktory kontaktuje sie z Toba i dopina szczegoly.",
    language: "Mozemy kontynuowac rozmowe po polsku, angielsku lub rosyjsku.",
    scope:
      "Wykonujemy prace remontowo-wykonczeniowe w nieruchomosciach, nie realizujemy lakierowania samochodow.",
    offTopic:
      "W tym czacie pomagam tylko w wycenie prac remontowo-wykonczeniowych i nie obslugujemy takich tematow.",
    generic:
      "Jasne, odpowiem krotko i jednoczesnie dopytam o dane potrzebne do wyceny.",
  }),
  en: Object.freeze({
    price:
      "Pricing is calculated from work scope and quantities, then finalized by a manager after review.",
    process:
      "After confirmation, I pass the draft estimate to a manager who contacts you to finalize details.",
    language: "We can continue in Polish, English, or Russian.",
    scope:
      "We handle renovation and finishing works for properties; we do not provide car painting services.",
    offTopic:
      "In this chat I can only help with renovation estimate requests, so this topic is outside our scope.",
    generic:
      "Sure, I will answer briefly and still collect the key details needed for the estimate.",
  }),
  ru: Object.freeze({
    price:
      "Цена считается по видам работ и объему, а финальную сумму подтверждает менеджер после проверки.",
    process:
      "После подтверждения я передаю черновую смету менеджеру, и он связывается с вами для финальных деталей.",
    language: "Мы можем продолжить на польском, английском или русском языке.",
    scope:
      "Мы выполняем ремонтно-отделочные работы по недвижимости и не занимаемся покраской автомобилей.",
    offTopic:
      "В этом чате я помогаю только с расчетом сметы по ремонтно-отделочным работам, по другим темам не консультируем.",
    generic:
      "Конечно, кратко отвечу и одновременно уточню ключевые данные для точной сметы.",
  }),
});

function getLanguagePack(language) {
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  return PROMPTS[normalizedLanguage] ?? PROMPTS.pl;
}

function getSalesStyle(language) {
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  return SALES_STYLE[normalizedLanguage] ?? SALES_STYLE.pl;
}

function enforceSalesTone(message, { status, language, suppressContactHint = false }) {
  const text = String(message ?? "").trim();
  if (!text) {
    return text;
  }

  const style = getSalesStyle(language);
  const lowered = text.toLowerCase();

  if (status === "ready_for_confirmation") {
    const hasButtonLabel = lowered.includes(style.confirmButtonLabel.toLowerCase());
    const contactHint = style.contactHint ? style.contactHint.toLowerCase() : "";
    const hasContactHint = contactHint ? lowered.includes(contactHint) : false;
    if (!hasButtonLabel) {
      return `${text}\n${style.confirmCta}`;
    }
    if (!suppressContactHint && contactHint && !hasContactHint) {
      return `${text}\n${style.contactHint}`;
    }
    return text;
  }

  return text;
}

function isQuestionLike(message) {
  return QUESTION_PATTERN.test(message) || QUESTION_WORD_PATTERN.test(message);
}

function hasContactSignals(message) {
  if (!message) {
    return false;
  }

  if (EMAIL_PATTERN.test(message)) {
    return true;
  }

  const matches = String(message).matchAll(PHONE_PATTERN);
  for (const match of matches) {
    const digits = String(match[1] ?? "").replace(/\D/g, "");
    if (digits.length >= 7) {
      return true;
    }
  }

  return false;
}

function hasProjectSignals(message) {
  if (!message) {
    return false;
  }

  return (
    AREA_OR_QUANTITY_SIGNAL_PATTERN.test(message) ||
    PROJECT_SCOPE_SIGNAL_PATTERN.test(message)
  );
}

function isLikelyOffTopicMessage({ message, extractedWorks }) {
  const normalizedMessage = String(message ?? "").trim();
  const currentWorks = Array.isArray(extractedWorks) ? extractedWorks : [];

  if (!normalizedMessage) {
    return false;
  }

  if (SCOPE_QUESTION_PATTERN.test(normalizedMessage)) {
    return true;
  }

  if (!isQuestionLike(normalizedMessage)) {
    return false;
  }

  if (GREETING_PATTERN.test(normalizedMessage)) {
    return false;
  }

  if (
    PRICE_QUESTION_PATTERN.test(normalizedMessage) ||
    PROCESS_QUESTION_PATTERN.test(normalizedMessage) ||
    LANGUAGE_QUESTION_PATTERN.test(normalizedMessage)
  ) {
    return false;
  }

  if (currentWorks.length > 0) {
    return false;
  }

  if (hasProjectSignals(normalizedMessage)) {
    return false;
  }

  return true;
}

function buildQuestionAnswer(latestUserMessage, language, { offTopic = false } = {}) {
  const message = String(latestUserMessage ?? "").trim();
  if (!message) {
    return null;
  }

  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  const dictionary = QUESTION_ANSWERS[normalizedLanguage] ?? QUESTION_ANSWERS.pl;

  if (SCOPE_QUESTION_PATTERN.test(message)) {
    return dictionary.scope;
  }

  if (!isQuestionLike(message)) {
    return null;
  }

  if (PRICE_QUESTION_PATTERN.test(message)) {
    return dictionary.price;
  }

  if (PROCESS_QUESTION_PATTERN.test(message)) {
    return dictionary.process;
  }

  if (LANGUAGE_QUESTION_PATTERN.test(message)) {
    return dictionary.language;
  }

  if (offTopic) {
    return dictionary.offTopic;
  }

  return null;
}

function injectQuestionAnswer(message, { latestUserMessage, language, offTopic = false }) {
  const base = String(message ?? "").trim();
  if (!base) {
    return base;
  }

  const answer = buildQuestionAnswer(latestUserMessage, language, { offTopic });
  if (!answer) {
    return base;
  }

  const loweredBase = base.toLowerCase();
  if (loweredBase.includes(answer.toLowerCase())) {
    return base;
  }

  return `${answer}\n${base}`;
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

function buildTemplateReply(status, questions, language, { contactOnly = false } = {}) {
  const pack = getLanguagePack(language);

  if (status === "confirmed") {
    return pack.confirmed;
  }

  if (status === "ready_for_confirmation") {
    if (contactOnly && pack.contact) {
      return pack.contact;
    }
    return pack.ready;
  }

  if (questions.length > 0) {
    return `${pack.clarifying}\n- ${questions.join("\n- ")}`;
  }

  return pack.generic;
}

function buildOffTopicFallback(status, questions, language) {
  const pack = getLanguagePack(language);
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  const dictionary = QUESTION_ANSWERS[normalizedLanguage] ?? QUESTION_ANSWERS.pl;
  const scopeReply = dictionary.offTopic ?? dictionary.scope;

  if (status === "ready_for_confirmation") {
    return `${scopeReply}\n${pack.ready}`;
  }

  if (questions.length > 0) {
    return `${scopeReply}\n${pack.clarifying}\n- ${questions.join("\n- ")}`;
  }

  return `${scopeReply}\n${pack.generic}`;
}

const CLARIFICATION_FOOTER = Object.freeze({
  pl: "Aby dokladnie policzyc wycene, podaj prosze:",
  en: "To prepare an accurate estimate, please provide:",
  ru: "Чтобы точно рассчитать смету, пожалуйста, укажите:",
});

function hasAllQuestionsIncluded(message, questions) {
  const normalized = String(message ?? "").toLowerCase();
  return questions.every((question) =>
    normalized.includes(String(question ?? "").toLowerCase()),
  );
}

function buildClarificationFooter(questions, language) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return "";
  }

  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  const header = CLARIFICATION_FOOTER[normalizedLanguage] ?? CLARIFICATION_FOOTER.pl;
  return `${header}\n- ${questions.join("\n- ")}`;
}

function ensureClarificationDataRequest(message, { status, questions, language, offTopic }) {
  const base = String(message ?? "").trim();
  const safeQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!base || safeQuestions.length === 0) {
    return base;
  }

  const needsDataRequest = status === "needs_clarification" || offTopic;
  if (!needsDataRequest || hasAllQuestionsIncluded(base, safeQuestions)) {
    return base;
  }

  const footer = buildClarificationFooter(safeQuestions, language);
  if (!footer) {
    return base;
  }

  return `${base}\n${footer}`;
}

async function buildAssistantMessage({
  composeAssistantMessage,
  language,
  status,
  questions,
  missingFields,
  latestUserMessage,
  estimate,
  offTopic = false,
  contactOnly = false,
}) {
  const fallbackMessage = offTopic
    ? buildOffTopicFallback(status, questions, language)
    : buildTemplateReply(status, questions, language, { contactOnly });

  if (contactOnly) {
    return enforceSalesTone(fallbackMessage, {
      status,
      language,
      suppressContactHint: true,
    });
  }

  if (typeof composeAssistantMessage !== "function") {
    return enforceSalesTone(fallbackMessage, { status, language });
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
      offTopic,
    });

    const normalized = String(generated ?? "").trim();
    if (normalized) {
      const withQuestionAnswer = injectQuestionAnswer(normalized, {
        latestUserMessage,
        language,
        offTopic,
      });
      const withDataRequest = ensureClarificationDataRequest(withQuestionAnswer, {
        status,
        questions,
        language,
        offTopic,
      });
      return enforceSalesTone(withDataRequest, { status, language });
    }
  } catch (error) {
    // Use deterministic fallback if AI phrasing fails.
  }

  const fallbackWithQuestionAnswer = injectQuestionAnswer(fallbackMessage, {
    latestUserMessage,
    language,
    offTopic,
  });
  const fallbackWithDataRequest = ensureClarificationDataRequest(
    fallbackWithQuestionAnswer,
    {
      status,
      questions,
      language,
      offTopic,
    },
  );
  return enforceSalesTone(fallbackWithDataRequest, { status, language });
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

      if (safeSession.status === "confirmed") {
        const userMessages = [...safeSession.userMessages, cleanedMessage];
        const assistantMessage = buildTemplateReply("confirmed", [], language);
        const updatedSession = {
          ...safeSession,
          updatedAt: nowIso(),
          lastUserMessage: cleanedMessage,
          userMessages,
          language,
          status: "confirmed",
        };

        return {
          session: updatedSession,
          response: {
            sessionId: updatedSession.sessionId,
            status: "confirmed",
            assistantMessage,
            questions: [],
            missingFields: [],
            warnings: updatedSession.warnings,
            works: updatedSession.works,
            estimate: updatedSession.estimate,
            language,
          },
        };
      }

      const extraction = await extractWorks(cleanedMessage);
      const normalized = normalizeWorks(extraction.works);
      const quantityResolved = resolveWorkQuantities({
        works: normalized.works,
        unresolvedQuantity: normalized.unresolvedQuantity,
        message: cleanedMessage,
      });
      const scopePruned = pruneImplicitWorks({
        works: quantityResolved.works,
        message: cleanedMessage,
      });

      const works = mergeWorkLists(safeSession.works, scopePruned.works);
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
        ...scopePruned.warnings,
        ...estimate.warnings,
      ]);

      const status =
        missingFields.length === 0 ? "ready_for_confirmation" : "needs_clarification";
      const contactOnly =
        status === "ready_for_confirmation" &&
        hasContactSignals(cleanedMessage) &&
        !isQuestionLike(cleanedMessage) &&
        !hasProjectSignals(cleanedMessage);
      const offTopic = isLikelyOffTopicMessage({
        message: cleanedMessage,
        extractedWorks: scopePruned.works,
      });

      const assistantMessage = await buildAssistantMessage({
        composeAssistantMessage,
        language,
        status,
        questions,
        missingFields,
        latestUserMessage: cleanedMessage,
        estimate,
        offTopic,
        contactOnly,
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
