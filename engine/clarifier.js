import { normalizeChatLanguage } from "./language.js";

const AREA_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(m2|m\^2|m²|sqm|кв\.?\s*м|квм)\b/i;
const DEADLINE_PATTERN =
  /\b(asap|urgent|pilne|szybko|tomorrow|jutro|pojutrze|next week|next month|w tym tygodniu|w przysz(?:ł|l)ym tygodniu|w przysz(?:ł|l)ym miesi(?:ą|a)cu|za\s+\d+\s*(day|days|week|weeks|month|months|dzien|dni|tydzien|tygodnie|tygodni|miesiac|miesiace|miesiecy)|\d+\s*(day|days|week|weeks|month|months)|срочно|завтра|послезавтра|на следующей неделе|на следующем месяце|через\s+\d+\s*(день|дня|дней|недел[яиюе]|месяц|месяца|месяцев))\b/i;
const FLOOR_PATTERN = /\b\d+\s*(floor|fl|pi(?:e|ę)tro|этаж)\b/i;
const LIFT_PATTERN =
  /\b(without?\s+(lift|elevator)|with\s+(lift|elevator)|bez\s+windy|z\s+wind(?:a|ą)|winda|без\s+лифт[ауы]?|с\s+лифт[ауы]?|лифт)\b/i;
const CITY_PATTERN =
  /\b(warsaw|warszawa|krakow|kraków|wroclaw|wroc(?:ł|l)aw|gdansk|gdańsk|gdynia|sopot|poznan|poznań|lodz|łódź|berlin|munich|london|paris|moscow|moskva|москва|санкт[-\s]?петербург|питер)\b/i;

const DEMOLITION_TYPES = new Set(["demolition_no_lift", "demolition_with_lift"]);

const QUESTION_BY_FIELD = Object.freeze({
  pl: Object.freeze({
    work_scope: "Jakie dokladnie prace mamy uwzglednic w wycenie?",
    area_or_quantity: "Podaj prosze powierzchnie w m2 lub ilosc sztuk dla kazdej pracy.",
    deadline: "Jaki jest planowany termin rozpoczecia lub deadline realizacji?",
    floor_number: "Na ktorym pietrze znajduje sie lokal?",
    lift_access: "Czy na miejscu jest dostepna winda?",
    city: "W jakim miescie znajduje sie inwestycja?",
  }),
  en: Object.freeze({
    work_scope: "Which exact works should be included in the estimate?",
    area_or_quantity: "Please provide area in m2 or item count for each work.",
    deadline: "What is the expected start date or deadline for the project?",
    floor_number: "What floor is the property on?",
    lift_access: "Is a lift/elevator available on site?",
    city: "In which city is the project located?",
  }),
  ru: Object.freeze({
    work_scope: "Какие именно работы нужно включить в смету?",
    area_or_quantity: "Укажите площадь в м2 или количество для каждой работы.",
    deadline: "Какой планируемый срок начала или дедлайн проекта?",
    floor_number: "На каком этаже находится объект?",
    lift_access: "Есть ли на объекте лифт?",
    city: "В каком городе находится объект?",
  }),
});

export function detectMissingFields({ message, works }) {
  const normalizedMessage = String(message ?? "");
  const normalizedWorks = Array.isArray(works) ? works : [];

  const missingFields = [];

  if (normalizedWorks.length === 0) {
    missingFields.push("work_scope");
  }

  const hasAnyPositiveQuantity = normalizedWorks.some(
    (work) => Number(work.quantity) > 0,
  );
  if (!hasAnyPositiveQuantity && !AREA_PATTERN.test(normalizedMessage)) {
    missingFields.push("area_or_quantity");
  }

  if (!DEADLINE_PATTERN.test(normalizedMessage)) {
    missingFields.push("deadline");
  }

  const hasDemolition = normalizedWorks.some((work) =>
    DEMOLITION_TYPES.has(work.type),
  );
  if (hasDemolition) {
    if (!LIFT_PATTERN.test(normalizedMessage)) {
      missingFields.push("lift_access");
    }

    if (!FLOOR_PATTERN.test(normalizedMessage)) {
      missingFields.push("floor_number");
    }
  }

  if (!CITY_PATTERN.test(normalizedMessage)) {
    missingFields.push("city");
  }

  return missingFields;
}

export function buildClarifyingQuestions(missingFields, { language = "pl" } = {}) {
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  const dictionary = QUESTION_BY_FIELD[normalizedLanguage] ?? QUESTION_BY_FIELD.pl;

  return missingFields.map((field) => dictionary[field]).filter(Boolean);
}
