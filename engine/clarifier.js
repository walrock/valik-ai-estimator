import { normalizeChatLanguage } from "./language.js";

const TOKEN_BOUNDARY_LEFT = String.raw`(?<![\p{L}\p{N}_])`;
const TOKEN_BOUNDARY_RIGHT = String.raw`(?![\p{L}\p{N}_])`;

const AREA_PATTERN = new RegExp(
  `${TOKEN_BOUNDARY_LEFT}\\d+(?:[.,]\\d+)?\\s*(?:m2|m\\^2|m²|м2|м\\^2|м²|sqm|кв\\.?\\s*м|квм)${TOKEN_BOUNDARY_RIGHT}`,
  "iu",
);
const FLOOR_PATTERN = new RegExp(
  `${TOKEN_BOUNDARY_LEFT}\\d+\\s*(?:floor|fl|pi(?:e|ę)tro|этаж(?:е|а|у)?)${TOKEN_BOUNDARY_RIGHT}`,
  "iu",
);
const LIFT_PATTERN = new RegExp(
  `${TOKEN_BOUNDARY_LEFT}(?:without?\\s+(?:lift|elevator)|with\\s+(?:lift|elevator)|bez\\s+windy|z\\s+wind(?:a|ą)|winda|без\\s+лифт[ауы]?|с\\s+лифт[ауы]?|лифт)${TOKEN_BOUNDARY_RIGHT}`,
  "iu",
);
const DEMOLITION_TYPES = new Set(["demolition_no_lift", "demolition_with_lift"]);

const QUESTION_BY_FIELD = Object.freeze({
  pl: Object.freeze({
    work_scope: "Jakie dokladnie prace mamy uwzglednic w wycenie?",
    area_or_quantity: "Podaj prosze powierzchnie w m2 lub ilosc sztuk dla kazdej pracy.",
    floor_number: "Na ktorym pietrze znajduje sie lokal?",
    lift_access: "Czy na miejscu jest dostepna winda?",
    city: "W jakim miescie znajduje sie inwestycja?",
  }),
  en: Object.freeze({
    work_scope: "Which exact works should be included in the estimate?",
    area_or_quantity: "Please provide area in m2 or item count for each work.",
    floor_number: "What floor is the property on?",
    lift_access: "Is a lift/elevator available on site?",
    city: "In which city is the project located?",
  }),
  ru: Object.freeze({
    work_scope: "Какие именно работы нужно включить в смету?",
    area_or_quantity: "Укажите площадь в м2 или количество для каждой работы.",
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

  return missingFields;
}

export function buildClarifyingQuestions(missingFields, { language = "pl" } = {}) {
  const normalizedLanguage = normalizeChatLanguage(language, "pl");
  const dictionary = QUESTION_BY_FIELD[normalizedLanguage] ?? QUESTION_BY_FIELD.pl;

  return missingFields.map((field) => dictionary[field]).filter(Boolean);
}
