const AREA_PATTERN = /\b\d+(?:[.,]\d+)?\s*(m2|m\^2|sqm)\b/i;
const DEADLINE_PATTERN =
  /\b(asap|urgent|tomorrow|next week|next month|\d+\s*(day|days|week|weeks|month|months))\b/i;
const FLOOR_PATTERN = /\b\d+\s*(floor|fl)\b/i;
const LIFT_PATTERN = /\b(without?\s+(lift|elevator)|with\s+(lift|elevator))\b/i;
const CITY_PATTERN =
  /\b(warsaw|krakow|wroclaw|gdansk|poznan|lodz|berlin|munich|london|paris)\b/i;

const DEMOLITION_TYPES = new Set(["demolition_no_lift", "demolition_with_lift"]);

const QUESTION_BY_FIELD = Object.freeze({
  work_scope: "Which exact works should be included in the estimate?",
  area_or_quantity: "Please provide area in m2 or item count for each work.",
  deadline: "What is the expected start date or deadline for the project?",
  floor_number: "What floor is the property on?",
  lift_access: "Is there a lift/elevator available for material removal?",
  city: "In which city is the project located?",
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
