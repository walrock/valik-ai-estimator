const AREA_PATTERN = /\b\d+(?:[.,]\d+)?\s*(m2|m\^2|m²|sqm)\b/i;
const DEADLINE_PATTERN =
  /\b(asap|urgent|pilne|tomorrow|jutro|pojutrze|next week|next month|w tym tygodniu|w przysz(?:ł|l)ym tygodniu|w przysz(?:ł|l)ym miesi(?:ą|a)cu|za\s+\d+\s*(day|days|week|weeks|month|months|dzien|dni|tydzien|tygodnie|tygodni|miesiac|miesiace|miesiecy)|\d+\s*(day|days|week|weeks|month|months))\b/i;
const FLOOR_PATTERN = /\b\d+\s*(floor|fl|pi(?:e|ę)tro)\b/i;
const LIFT_PATTERN =
  /\b(without?\s+(lift|elevator)|with\s+(lift|elevator)|bez\s+windy|z\s+wind(?:a|ą)|winda)\b/i;
const CITY_PATTERN =
  /\b(warsaw|warszawa|krakow|kraków|wroclaw|wroc(?:ł|l)aw|gdansk|gdańsk|gdynia|sopot|poznan|poznań|lodz|łódź|berlin|munich|london|paris)\b/i;

const DEMOLITION_TYPES = new Set(["demolition_no_lift", "demolition_with_lift"]);

const QUESTION_BY_FIELD = Object.freeze({
  work_scope: "Jakie dokładnie prace mamy uwzględnić w wycenie?",
  area_or_quantity: "Podaj proszę powierzchnię w m2 lub ilość sztuk dla każdej pracy.",
  deadline: "Jaki jest planowany termin rozpoczęcia lub deadline realizacji?",
  floor_number: "Na którym piętrze znajduje się lokal?",
  lift_access: "Czy na miejscu jest dostępna winda?",
  city: "W jakim mieście znajduje się inwestycja?",
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

export function buildClarifyingQuestions(missingFields) {
  return missingFields
    .map((field) => QUESTION_BY_FIELD[field])
    .filter(Boolean);
}
