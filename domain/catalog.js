import { pricing } from "../config/pricing.js";

const META_KEYS = new Set();

export const WORK_CATEGORIES = Object.freeze(
  Object.keys(pricing).filter((key) => !META_KEYS.has(key)),
);

export const WORK_TYPES_BY_CATEGORY = Object.freeze(
  Object.fromEntries(
    WORK_CATEGORIES.map((category) => [category, Object.keys(pricing[category])]),
  ),
);

const WORK_TYPE_SETS_BY_CATEGORY = Object.freeze(
  Object.fromEntries(
    WORK_CATEGORIES.map((category) => [
      category,
      new Set(WORK_TYPES_BY_CATEGORY[category]),
    ]),
  ),
);

const ALL_WORK_TYPES_SET = new Set(
  WORK_CATEGORIES.flatMap((category) => WORK_TYPES_BY_CATEGORY[category]),
);

export function getWorkTypes(category) {
  return WORK_TYPES_BY_CATEGORY[category] ?? [];
}

export function isKnownCategory(category) {
  return WORK_CATEGORIES.includes(category);
}

export function isKnownType(category, type) {
  const set = WORK_TYPE_SETS_BY_CATEGORY[category];
  if (!set) {
    return false;
  }

  return set.has(type);
}

export function inferCategoryFromType(type) {
  for (const category of WORK_CATEGORIES) {
    if (isKnownType(category, type)) {
      return category;
    }
  }

  return null;
}

export function hasKnownType(type) {
  return ALL_WORK_TYPES_SET.has(type);
}

export function describeCatalog() {
  return WORK_CATEGORIES.map(
    (category) => `${category}: ${WORK_TYPES_BY_CATEGORY[category].join(", ")}`,
  ).join("\n");
}
