import {
  WORK_CATEGORIES,
  inferCategoryFromType,
  isKnownCategory,
  isKnownType,
} from "../domain/catalog.js";
import { RawExtractionSchema } from "../domain/schemas.js";

const CATEGORY_ALIASES = Object.freeze({
  tile: "tiling",
  tiles: "tiling",
  tiler: "tiling",
  painting_work: "painting",
  paint: "painting",
  plasterboard: "drywall",
  gk: "drywall",
  floor: "flooring",
  floors: "flooring",
  electric: "electrical",
  electrician: "electrical",
  plumbing_work: "plumbing",
});

const TYPE_ALIASES = Object.freeze({
  painting: Object.freeze({
    primer: "priming",
    prime: "priming",
    grunt: "priming",
    paint_two_layers: "paint_2_layers",
    paint_2_coats: "paint_2_layers",
  }),
  tiling: Object.freeze({
    tile_10x15: "tile_10_15",
    tile_30x60: "tile_30_60",
    tile_60x120: "tile_60_120",
    tile_60x60: "tile_60_120",
    demolition_without_lift: "demolition_no_lift",
    demolition_with_elevator: "demolition_with_lift",
    waterproof: "waterproofing",
  }),
  drywall: Object.freeze({
    drywall_ceiling: "ceiling",
    drywall_frame_wall: "wall_frame",
  }),
  flooring: Object.freeze({
    laminate_floor: "laminate",
    glued_parquet: "parquet_glue",
    click_parquet: "parquet_click",
  }),
  plumbing: Object.freeze({
    wc_install: "toilet_install",
    shower_cabin_install: "shower_install",
  }),
  electrical: Object.freeze({
    power_point: "electric_point",
    socket: "socket_install",
    light: "light_install",
  }),
});

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategory(rawCategory) {
  const normalized = normalizeToken(rawCategory);
  if (!normalized) {
    return null;
  }

  if (isKnownCategory(normalized)) {
    return normalized;
  }

  return CATEGORY_ALIASES[normalized] ?? null;
}

function normalizeType(category, rawType) {
  const normalized = normalizeToken(rawType);
  if (!normalized) {
    return null;
  }

  if (isKnownType(category, normalized)) {
    return normalized;
  }

  const alias = TYPE_ALIASES[category]?.[normalized];
  if (alias && isKnownType(category, alias)) {
    return alias;
  }

  return null;
}

function normalizeQuantity(rawQuantity) {
  if (typeof rawQuantity === "string") {
    const asNumber = Number(rawQuantity.replace(",", "."));
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }

    return null;
  }

  const asNumber = Number(rawQuantity);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return null;
  }

  return asNumber;
}

function resolveCategoryAndType(rawWork) {
  const initialCategory = normalizeCategory(rawWork.category);

  if (initialCategory) {
    const canonicalType = normalizeType(initialCategory, rawWork.type);
    if (canonicalType) {
      return { category: initialCategory, type: canonicalType };
    }
  }

  const typeToken = normalizeToken(rawWork.type);
  if (!typeToken) {
    return { category: initialCategory, type: null };
  }

  const inferredCategory = inferCategoryFromType(typeToken);
  if (inferredCategory) {
    return { category: inferredCategory, type: typeToken };
  }

  for (const category of WORK_CATEGORIES) {
    const aliasType = TYPE_ALIASES[category]?.[typeToken];
    if (aliasType && isKnownType(category, aliasType)) {
      return { category, type: aliasType };
    }
  }

  if (initialCategory) {
    const aliasType = normalizeType(initialCategory, typeToken);
    if (aliasType) {
      return { category: initialCategory, type: aliasType };
    }
  }

  return { category: initialCategory, type: null };
}

export function normalizeWorks(input) {
  const payload = Array.isArray(input) ? { works: input } : input;
  const parsedPayload = RawExtractionSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      works: [],
      warnings: ["Extraction payload is invalid and was ignored."],
      rejected: [],
      unresolvedQuantity: [],
    };
  }

  const merged = new Map();
  const warnings = [];
  const rejected = [];
  const unresolvedQuantity = [];

  parsedPayload.data.works.forEach((rawWork, index) => {
    const { category, type } = resolveCategoryAndType(rawWork);
    const quantity = normalizeQuantity(rawWork.quantity);

    if (!category || !type) {
      rejected.push({ index, rawWork });
      warnings.push(
        `works[${index}] skipped: category/type could not be normalized.`,
      );
      return;
    }

    if (!quantity) {
      unresolvedQuantity.push({
        index,
        category,
        type,
        rawQuantity: rawWork.quantity,
      });
      warnings.push(`works[${index}] missing quantity: requires inference.`);
      return;
    }

    const key = `${category}:${type}`;
    const current = merged.get(key);
    if (current) {
      current.quantity = Number((current.quantity + quantity).toFixed(4));
      return;
    }

    merged.set(key, { category, type, quantity });
  });

  return {
    works: [...merged.values()],
    warnings,
    rejected,
    unresolvedQuantity,
  };
}
