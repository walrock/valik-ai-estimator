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
    confirmed:
      "Wycena jest juz potwierdzona i przekazana do opiekuna. Aby przygotowac nowa wycene, rozpocznij nowa rozmowe.",
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
    confirmed:
      "This estimate is already confirmed and handed over to a manager. To prepare a new one, please start a new chat.",
    clarifying:
      "Great, I need a few more details to complete an accurate estimate:",
    generic:
      "Please share a few more details about works and quantities, and I will prepare a more accurate estimate.",
  }),
  ru: Object.freeze({
    initial: "Опишите работы, площадь/количество, город и желаемые сроки.",
    ready:
      "Черновая смета готова. Если все верно, нажмите \"Подтвердить смету\", и я передам данные менеджеру.",
    confirmed:
      "Эта смета уже подтверждена и передана менеджеру. Чтобы сделать новую смету, начните новый диалог.",
    clarifying:
      "Отлично, чтобы подготовить точную смету, мне нужно еще несколько деталей:",
    generic:
      "Пожалуйста, уточните работы и объемы, и я подготовлю более точную смету.",
  }),
});

const SALES_STYLE = Object.freeze({
  pl: Object.freeze({
    warmPrefix: "Super,",
    confirmButtonLabel: "Potwierdz wycene",
    confirmCta:
      'Jesli wszystko sie zgadza, kliknij "Potwierdz wycene", a przekaze dane do opiekuna.',
  }),
  en: Object.freeze({
    warmPrefix: "Great,",
    confirmButtonLabel: "Confirm estimate",
    confirmCta:
      'If everything looks good, click "Confirm estimate" and I will pass it to a manager.',
  }),
  ru: Object.freeze({
    warmPrefix: "Отлично,",
    confirmButtonLabel: "Подтвердить смету",
    confirmCta:
      'Если все верно, нажмите "Подтвердить смету", и я передам данные менеджеру.',
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
  /(?:estimate|quotation|quote|pricing|price|cost|paint|painting|plaster|tile|tiling|wall|walls|ceiling|floor|room|apartment|flat|house|renovat|remodel|repair|deadline|start date|city|malow|farb|szpachl|gips|tynk|plytk|płytk|scian|ścian|sufit|podlog|podłog|remont|wycen|koszt|termin|miast|mieszkan|łazien|lazien|kuchni|pokoj|покрас|краск|шпакл|штукатур|плитк|стен|потол|пол|ремонт|смет|оценк|стоимост|дедлайн|срок|город|объект|квартир|дом|ванн|кухн)/iu;
const PRICE_QUESTION_PATTERN =
  /(?:\bprice\b|\bcost\b|\bcena\b|\bkoszt\b|wycen|цен|стоим|сколько)/i;
const PROCESS_QUESTION_PATTERN =
  /(?:what next|how (?:it )?works|after confirmation|co dalej|jak to dzia(?:ł|l)a|po potwierdzeniu|как это работает|что дальше|после подтверж)/i;
const LANGUAGE_QUESTION_PATTERN =
  /(?:language|english|polish|russian|język|po polsku|по-рус|на каком языке)/i;
const SCOPE_QUESTION_PATTERN =
  /(?:car|cars|automotive|машин|авто|samochod|samochody)/i;

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

function enforceSalesTone(message, { status, language }) {
  const text = String(message ?? "").trim();
  if (!text) {
    return text;
  }

  const style = getSalesStyle(language);
  const lowered = text.toLowerCase();

  if (status === "ready_for_confirmation") {
    const hasButtonLabel = lowered.includes(style.confirmButtonLabel.toLowerCase());
    if (!hasButtonLabel) {
      return `${text}\n${style.confirmCta}`;
    }
    return text;
  }

  if (status === "needs_clarification") {
    const prefixLowered = style.warmPrefix.toLowerCase();
    if (!lowered.startsWith(prefixLowered)) {
      return `${style.warmPrefix} ${text}`;
    }
  }

  return text;
}

function isQuestionLike(message) {
  return QUESTION_PATTERN.test(message) || QUESTION_WORD_PATTERN.test(message);
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

function buildTemplateReply(status, questions, language) {
  const pack = getLanguagePack(language);

  if (status === "confirmed") {
    return pack.confirmed;
  }

  if (status === "ready_for_confirmation") {
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

async function buildAssistantMessage({
  composeAssistantMessage,
  language,
  status,
  questions,
  missingFields,
  latestUserMessage,
  estimate,
  offTopic = false,
}) {
  const fallbackMessage = offTopic
    ? buildOffTopicFallback(status, questions, language)
    : buildTemplateReply(status, questions, language);

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
      return enforceSalesTone(withQuestionAnswer, { status, language });
    }
  } catch (error) {
    // Use deterministic fallback if AI phrasing fails.
  }

  const fallbackWithQuestionAnswer = injectQuestionAnswer(fallbackMessage, {
    latestUserMessage,
    language,
    offTopic,
  });
  return enforceSalesTone(fallbackWithQuestionAnswer, { status, language });
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
      const offTopic = isLikelyOffTopicMessage({
        message: cleanedMessage,
        extractedWorks: quantityResolved.works,
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
