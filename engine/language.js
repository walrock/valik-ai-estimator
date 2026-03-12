export const CHAT_LANGUAGES = Object.freeze(["pl", "en", "ru"]);

const CYRILLIC_PATTERN = /[\u0400-\u04FF]/u;
const POLISH_CHAR_PATTERN = /[ąćęłńóśźż]/iu;
const POLISH_WORD_PATTERN =
  /\b(czesc|dzien dobry|prosze|wycena|lazienka|mieszkanie|remont|winda|pietro|miasto|warszawa|gdansk|gdynia|sopot)\b/i;
const ENGLISH_WORD_PATTERN =
  /\b(hello|hi|please|estimate|bathroom|kitchen|renovation|repair|paint|tile|floor|lift|city)\b/i;

export function normalizeChatLanguage(value, fallback = "pl") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (CHAT_LANGUAGES.includes(normalized)) {
    return normalized;
  }

  return fallback;
}

export function detectChatLanguage(message, { fallback = null } = {}) {
  const text = String(message ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (CYRILLIC_PATTERN.test(text)) {
    return "ru";
  }

  if (POLISH_CHAR_PATTERN.test(text) || POLISH_WORD_PATTERN.test(text)) {
    return "pl";
  }

  if (ENGLISH_WORD_PATTERN.test(text)) {
    return "en";
  }

  return fallback;
}
