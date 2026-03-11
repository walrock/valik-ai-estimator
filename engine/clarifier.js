import { normalizeChatLanguage } from "./language.js";

const TOKEN_BOUNDARY_LEFT = String.raw`(?<![\p{L}\p{N}_])`;
const TOKEN_BOUNDARY_RIGHT = String.raw`(?![\p{L}\p{N}_])`;
const RU_MONTH_PATTERN =
  "(?:январ[ьяе]|феврал[ьяе]|март[ае]?|апрел[ьяе]|ма[йяе]|июн[ьяе]|июл[ьяе]|август[ае]?|сентябр[ьяе]|октябр[ьяе]|ноябр[ьяе]|декабр[ьяе])";
const PL_MONTH_PATTERN =
  "(?:styczni[aeu]|lut(?:y|ego)|marca|kwietni[aeu]|maja|czerwca|lipca|sierpni[aeu]|wrze(?:ś|s)ni[aeu]|pa(?:ź|z)dziernik[aeu]|listopada|grudni[aeu])";
const EN_MONTH_PATTERN =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const AREA_PATTERN = new RegExp(
  `${TOKEN_BOUNDARY_LEFT}\\d+(?:[.,]\\d+)?\\s*(?:m2|m\\^2|m²|м2|м\\^2|м²|sqm|кв\\.?\\s*м|квм)${TOKEN_BOUNDARY_RIGHT}`,
  "iu",
);
const DEADLINE_PATTERN = new RegExp(
  [
    `${TOKEN_BOUNDARY_LEFT}(?:`,
    [
      "asap",
      "urgent",
      "pilne",
      "szybko",
      "tomorrow",
      "jutro",
      "pojutrze",
      "next week",
      "next month",
      "w tym tygodniu",
      "w przysz(?:ł|l)ym tygodniu",
      "w przysz(?:ł|l)ym miesi(?:ą|a)cu",
      "za\\s+\\d+\\s*(?:day|days|week|weeks|month|months|dzien|dni|tydzien|tygodnie|tygodni|miesiac|miesiace|miesiecy)",
      "\\d+\\s*(?:day|days|week|weeks|month|months)",
      "срочно",
      "сегодня",
      "сейчас",
      "прямо\\s+сейчас",
      "как\\s+можно\\s+скорее",
      "в\\s+ближайшие\\s+дни",
      "завтра",
      "послезавтра",
      "на следующей неделе",
      "на следующем месяце",
      "через\\s+\\d+\\s*(?:день|дня|дней|недел[яиюе]|месяц|месяца|месяцев)",
      "(?:срок|скрок|deadline|termin|start(?:\\s+date)?|rozpoczecie|rozpoczecia)\\s*[:\\-]?\\s*\\d+\\s*(?:day|days|week|weeks|month|months|dzien|dni|tydzien|tygodnie|tygodni|miesiac|miesiace|miesiecy|день|дня|дней|недел[яиюе]|месяц|месяца|месяцев)",
      "(?:срок|скрок)\\s*[:\\-]?\\s*(?:пару|пара|несколько)\\s*(?:дней|недель|месяцев)",
      "(?:с|со|od|from)\\s+\\d{1,2}\\s*(?:" +
        RU_MONTH_PATTERN +
        "|" +
        PL_MONTH_PATTERN +
        "|" +
        EN_MONTH_PATTERN +
        ")",
      "(?:deadline|termin|start(?:\\s+date)?|od|from|с|со|до)\\s+\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?",
    ].join("|"),
    `)${TOKEN_BOUNDARY_RIGHT}`,
  ].join(""),
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
const CITY_PATTERN = new RegExp(
  `${TOKEN_BOUNDARY_LEFT}(?:` +
    [
      "warsaw[\\p{L}]*",
      "warszaw[\\p{L}]*",
      "варшав[\\p{L}]*",
      "krakow[\\p{L}]*",
      "kraków[\\p{L}]*",
      "краков[\\p{L}]*",
      "wroclaw[\\p{L}]*",
      "wroc(?:ł|l)aw[\\p{L}]*",
      "вроцлав[\\p{L}]*",
      "gdansk[\\p{L}]*",
      "gda(?:ń|n)sk[\\p{L}]*",
      "гдань?ск[\\p{L}]*",
      "gdyni[\\p{L}]*",
      "гдын[\\p{L}]*",
      "sopot[\\p{L}]*",
      "сопот[\\p{L}]*",
      "poznan[\\p{L}]*",
      "poznań[\\p{L}]*",
      "познан[\\p{L}]*",
      "lodz[\\p{L}]*",
      "łódź[\\p{L}]*",
      "лодз[\\p{L}]*",
      "trojmiast[\\p{L}]*",
      "trójmiast[\\p{L}]*",
      "троймяст[\\p{L}]*",
      "berlin[\\p{L}]*",
      "берлин[\\p{L}]*",
      "munich[\\p{L}]*",
      "m[üu]nchen[\\p{L}]*",
      "мюнхен[\\p{L}]*",
      "london[\\p{L}]*",
      "лондон[\\p{L}]*",
      "paris[\\p{L}]*",
      "pary(?:ż|z)[\\p{L}]*",
      "париж[\\p{L}]*",
      "moscow[\\p{L}]*",
      "moskva[\\p{L}]*",
      "москв[\\p{L}]*",
      "saint[-\\s]?petersburg",
      "st\\.?\\s?petersburg",
      "санкт[-\\s]?петербург",
      "питер[\\p{L}]*",
    ].join("|") +
    `)${TOKEN_BOUNDARY_RIGHT}`,
  "iu",
);

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
