import { pricing } from "../config/pricing.js";

const AREA_REGEX = /\b(\d+(?:[.,]\d+)?)\s*(m2|m\^2|sqm|m²)\b/giu;
const PCS_REGEX =
  /\b(\d+(?:[.,]\d+)?)\s*(pcs|pc|pieces?|szt|шт|points?|punkty|punktow)\b/giu;

const TYPE_PATTERNS = Object.freeze({
  socket_install:
    /\b(\d+(?:[.,]\d+)?)\s*(socket|sockets|gniazdo|gniazda|gniazd|gniazdek)\b/i,
  light_install: /\b(\d+(?:[.,]\d+)?)\s*(light|lights|lamp|lamps|opraw)\b/i,
  electric_point:
    /\b(\d+(?:[.,]\d+)?)\s*(electric\s*points?|punkty?\s*elektrycz)\b/i,
  water_point: /\b(\d+(?:[.,]\d+)?)\s*(water\s*points?|punkty?\s*wodn)\b/i,
  heating_point:
    /\b(\d+(?:[.,]\d+)?)\s*(heating\s*points?|punkty?\s*grzew)\b/i,
  toilet_install: /\b(\d+(?:[.,]\d+)?)\s*(toilet|toilets|wc|sedes)\b/i,
  shower_install: /\b(\d+(?:[.,]\d+)?)\s*(shower|showers|prysznic|kabin)\b/i,
});

function parseNumber(rawValue) {
  const value = Number(String(rawValue).replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function extractNumbers(message, regex) {
  const values = [];
  let match;

  while ((match = regex.exec(message)) !== null) {
    const numeric = parseNumber(match[1]);
    if (numeric) {
      values.push(numeric);
    }
  }

  return values;
}

function unique(values) {
  return [...new Set(values)];
}

function singleStableValue(values) {
  if (values.length === 0) {
    return null;
  }

  const uniq = unique(values);
  if (uniq.length === 1) {
    return uniq[0];
  }

  return null;
}

function getWorkUnit(work) {
  return pricing[work.category]?.[work.type]?.unit ?? null;
}

function mergeWorks(works) {
  const merged = new Map();

  works.forEach((work) => {
    const key = `${work.category}:${work.type}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Number((existing.quantity + work.quantity).toFixed(4));
      return;
    }

    merged.set(key, { ...work });
  });

  return [...merged.values()];
}

function inferFromTypePattern(message, workType) {
  const pattern = TYPE_PATTERNS[workType];
  if (!pattern) {
    return null;
  }

  const match = message.match(pattern);
  if (!match) {
    return null;
  }

  return parseNumber(match[1]);
}

function inferQuantityForWork({ message, work, areaValue, piecesValue }) {
  const unit = getWorkUnit(work);
  const patternValue = inferFromTypePattern(message, work.type);

  if (patternValue) {
    return patternValue;
  }

  if (unit === "m2") {
    return areaValue;
  }

  if (unit === "pcs") {
    return piecesValue;
  }

  return null;
}

export function resolveWorkQuantities({ works, unresolvedQuantity, message }) {
  const normalizedMessage = String(message ?? "");
  const normalizedWorks = Array.isArray(works) ? works : [];
  const unresolved = Array.isArray(unresolvedQuantity) ? unresolvedQuantity : [];

  const areaValues = extractNumbers(normalizedMessage, AREA_REGEX);
  const piecesValues = extractNumbers(normalizedMessage, PCS_REGEX);
  const areaValue = singleStableValue(areaValues);
  const piecesValue = singleStableValue(piecesValues);

  const warnings = [];
  const resolved = [];

  normalizedWorks.forEach((work, index) => {
    let quantity = work.quantity;
    const inferred = inferQuantityForWork({
      message: normalizedMessage,
      work,
      areaValue,
      piecesValue,
    });

    if (quantity === 1 && inferred && inferred > 1) {
      quantity = inferred;
      warnings.push(
        `works[${index}] quantity auto-corrected from 1 to ${inferred}.`,
      );
    }

    resolved.push({ ...work, quantity });
  });

  unresolved.forEach((work) => {
    const inferred = inferQuantityForWork({
      message: normalizedMessage,
      work,
      areaValue,
      piecesValue,
    });

    if (!inferred) {
      warnings.push(
        `works[${work.index}] skipped: quantity is missing and could not be inferred.`,
      );
      return;
    }

    resolved.push({
      category: work.category,
      type: work.type,
      quantity: inferred,
    });
    warnings.push(`works[${work.index}] quantity inferred as ${inferred}.`);
  });

  if (!areaValue && areaValues.length > 1) {
    warnings.push(
      `Multiple area values detected (${areaValues.join(", ")}). Quantity auto-fill was limited.`,
    );
  }

  if (!piecesValue && piecesValues.length > 1) {
    warnings.push(
      `Multiple piece values detected (${piecesValues.join(", ")}). Quantity auto-fill was limited.`,
    );
  }

  return {
    works: mergeWorks(resolved),
    warnings,
    quantityHints: {
      areaValues,
      piecesValues,
      areaValue,
      piecesValue,
    },
  };
}
