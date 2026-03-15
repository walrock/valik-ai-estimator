const GENERIC_PAINT_SIGNAL =
  /(?:\bpaint(?:ing)?\b|malow(?:anie|ac|a[ćc])|farb(?:a|y)?|покрас|краск)/iu;

const EXPLICIT_PAINTING_PATTERNS = Object.freeze({
  project_design: /(?:projekt|pomiar|project|design|measurement|замер|проект)/iu,
  preparation:
    /(?:przygotowan|preparation|подготов|zabezpieczen|protection|cleaning)/iu,
  putty_2_layers: /(?:szpachl|gla[dt][zź]|putty|skim\s*coat|шпакл)/iu,
  priming: /(?:grunt(?:ow|owanie)?|primer|prime|грунт)/iu,
  primer_paint:
    /(?:farb(?:a|y)?\s+gruntuj|gruntowanie z malowaniem|primer\s*paint|paint\s*primer|грунт.*краск)/iu,
});

const PAINTING_PACKAGE_TYPES = new Set(Object.keys(EXPLICIT_PAINTING_PATTERNS));

function cloneWork(work) {
  return {
    category: work.category,
    type: work.type,
    quantity: work.quantity,
  };
}

export function pruneImplicitWorks({ works = [], message = "" }) {
  const sourceWorks = Array.isArray(works) ? works : [];
  const normalizedMessage = String(message ?? "");

  if (sourceWorks.length === 0) {
    return { works: [], warnings: [] };
  }

  const keptWorks = [];
  const warnings = [];
  const paintingWorks = sourceWorks.filter((work) => work.category === "painting");

  for (const work of sourceWorks) {
    if (work.category !== "painting") {
      keptWorks.push(cloneWork(work));
      continue;
    }

    if (!PAINTING_PACKAGE_TYPES.has(work.type)) {
      keptWorks.push(cloneWork(work));
      continue;
    }

    const matchesExplicitSignal = EXPLICIT_PAINTING_PATTERNS[work.type].test(
      normalizedMessage,
    );

    if (matchesExplicitSignal) {
      keptWorks.push(cloneWork(work));
      continue;
    }

    warnings.push(
      `Removed implicitly inferred work "${work.type}" because it was not explicitly requested.`,
    );
  }

  const hasPaintSignal = GENERIC_PAINT_SIGNAL.test(normalizedMessage);
  const hasExplicitPaintWork = keptWorks.some(
    (work) => work.category === "painting" && work.type === "paint_2_layers",
  );

  if (hasPaintSignal && !hasExplicitPaintWork) {
    const fallbackSource =
      paintingWorks.find((work) => work.type === "paint_2_layers") ??
      paintingWorks.find((work) => typeof work.quantity === "number");

    if (fallbackSource) {
      keptWorks.push({
        category: "painting",
        type: "paint_2_layers",
        quantity: fallbackSource.quantity,
      });
      warnings.push(
        'Added fallback work "paint_2_layers" for a generic painting request.',
      );
    }
  }

  return {
    works: keptWorks,
    warnings,
  };
}
