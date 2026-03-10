import test from "node:test";
import assert from "node:assert/strict";
import { calculateProject } from "../engine/calculator.js";

test("calculator computes subtotal and applies minimum order adjustment", () => {
  const result = calculateProject([
    { category: "tiling", type: "tile_30_60", quantity: 6 },
  ]);

  assert.equal(result.subtotal, 840);
  assert.equal(result.total, 1000);
  assert.deepEqual(result.appliedRules, ["minimum_order"]);
  assert.equal(result.breakdown.at(-1).name, "minimum_order_adjustment");
});

test("calculator skips invalid items and returns warnings", () => {
  const result = calculateProject([
    { category: "painting", type: "primer", quantity: 10 },
    { category: "painting", type: "paint_2_layers", quantity: 10 },
  ]);

  assert.equal(result.warnings.length, 1);
  assert.equal(result.subtotal, 250);
});

test("calculator leaves total equal to subtotal when minimum order is not needed", () => {
  const result = calculateProject([
    { category: "tiling", type: "tile_60_120", quantity: 10 },
    { category: "painting", type: "wallpaper_install", quantity: 10 },
  ]);

  assert.equal(result.subtotal, 2550);
  assert.equal(result.total, 2550);
  assert.deepEqual(result.appliedRules, []);
});
