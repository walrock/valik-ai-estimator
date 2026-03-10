export function mergeWorkLists(...lists) {
  const merged = new Map();

  lists.flat().forEach((work) => {
    if (!work) {
      return;
    }

    const key = `${work.category}:${work.type}`;
    const current = merged.get(key);
    if (current) {
      current.quantity = Number((current.quantity + work.quantity).toFixed(4));
      return;
    }

    merged.set(key, { ...work });
  });

  return [...merged.values()];
}
