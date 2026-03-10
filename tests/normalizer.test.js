import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorks } from "../engine/normalizer.js";

test("normalizer maps aliases to canonical work types", () => {
  const result = normalizeWorks([
    { category: "painting", type: "primer", quantity: "10" },
  ]);

  assert.deepEqual(result.works, [
    { category: "painting", type: "priming", quantity: 10 },
  ]);
  assert.equal(result.warnings.length, 0);
});

test("normalizer accepts category and type aliases", () => {
  const result = normalizeWorks([
    { category: "tiles", type: "tile 30x60", quantity: 6 },
  ]);

  assert.deepEqual(result.works, [
    { category: "tiling", type: "tile_30_60", quantity: 6 },
  ]);
});

test("normalizer merges duplicate normalized items", () => {
  const result = normalizeWorks([
    { category: "tiling", type: "tile_30_60", quantity: 4 },
    { category: "tiling", type: "tile 30x60", quantity: "1.5" },
  ]);

  assert.deepEqual(result.works, [
    { category: "tiling", type: "tile_30_60", quantity: 5.5 },
  ]);
});

test("normalizer rejects unknown types with warning", () => {
  const result = normalizeWorks([
    { category: "painting", type: "magic_finish", quantity: 3 },
  ]);

  assert.deepEqual(result.works, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.warnings.length, 1);
});

test("normalizer parses quantity with comma decimal", () => {
  const result = normalizeWorks([
    { category: "flooring", type: "laminate", quantity: "12,5" },
  ]);

  assert.deepEqual(result.works, [
    { category: "flooring", type: "laminate", quantity: 12.5 },
  ]);
});
