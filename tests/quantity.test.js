import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkQuantities } from "../engine/quantity.js";

test("quantity resolver replaces default 1 with stable area value", () => {
  const result = resolveWorkQuantities({
    works: [{ category: "tiling", type: "tile_30_60", quantity: 1 }],
    unresolvedQuantity: [],
    message: "Bathroom 8m2 tiling",
  });

  assert.deepEqual(result.works, [
    { category: "tiling", type: "tile_30_60", quantity: 8 },
  ]);
});

test("quantity resolver infers missing quantity from area and keeps merged output", () => {
  const result = resolveWorkQuantities({
    works: [{ category: "painting", type: "paint_2_layers", quantity: 1 }],
    unresolvedQuantity: [
      {
        index: 1,
        category: "painting",
        type: "priming",
      },
    ],
    message: "Room 12m2, need primer and paint",
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "paint_2_layers", quantity: 12 },
    { category: "painting", type: "priming", quantity: 12 },
  ]);
});

test("quantity resolver extracts type-specific pcs quantities", () => {
  const result = resolveWorkQuantities({
    works: [
      { category: "electrical", type: "socket_install", quantity: 1 },
      { category: "electrical", type: "light_install", quantity: 1 },
    ],
    unresolvedQuantity: [],
    message: "Install 4 sockets and 2 lights in kitchen",
  });

  assert.deepEqual(result.works, [
    { category: "electrical", type: "socket_install", quantity: 4 },
    { category: "electrical", type: "light_install", quantity: 2 },
  ]);
});

test("quantity resolver infers linear meter values for linear services", () => {
  const result = resolveWorkQuantities({
    works: [{ category: "painting", type: "acrylic_corners", quantity: 1 }],
    unresolvedQuantity: [],
    message: "Acrylic corners 12 m/p",
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "acrylic_corners", quantity: 12 },
  ]);
});

test("quantity resolver infers rib values for radiator painting", () => {
  const result = resolveWorkQuantities({
    works: [{ category: "painting", type: "radiator_paint", quantity: 1 }],
    unresolvedQuantity: [],
    message: "Paint radiator 14 ribs",
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "radiator_paint", quantity: 14 },
  ]);
});

test("quantity resolver infers module values for switchboards", () => {
  const result = resolveWorkQuantities({
    works: [{ category: "electrical", type: "switchboard_install", quantity: 1 }],
    unresolvedQuantity: [],
    message: "Switchboard 24 modules",
  });

  assert.deepEqual(result.works, [
    { category: "electrical", type: "switchboard_install", quantity: 24 },
  ]);
});
