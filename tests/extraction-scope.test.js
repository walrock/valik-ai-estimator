import test from "node:test";
import assert from "node:assert/strict";
import { pruneImplicitWorks } from "../engine/extraction-scope.js";

test("generic painting request keeps only explicit painting work", () => {
  const result = pruneImplicitWorks({
    message: "malowanie 20 m2",
    works: [
      { category: "painting", type: "project_design", quantity: 20 },
      { category: "painting", type: "preparation", quantity: 20 },
      { category: "painting", type: "putty_2_layers", quantity: 20 },
      { category: "painting", type: "priming", quantity: 20 },
      { category: "painting", type: "primer_paint", quantity: 20 },
      { category: "painting", type: "paint_2_layers", quantity: 20 },
    ],
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "paint_2_layers", quantity: 20 },
  ]);
  assert.ok(result.warnings.length >= 1);
});

test("explicitly mentioned preparation works are preserved", () => {
  const result = pruneImplicitWorks({
    message: "szpachlowanie, gruntowanie i malowanie 20 m2",
    works: [
      { category: "painting", type: "putty_2_layers", quantity: 20 },
      { category: "painting", type: "priming", quantity: 20 },
      { category: "painting", type: "paint_2_layers", quantity: 20 },
    ],
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "putty_2_layers", quantity: 20 },
    { category: "painting", type: "priming", quantity: 20 },
    { category: "painting", type: "paint_2_layers", quantity: 20 },
  ]);
  assert.equal(result.warnings.length, 0);
});

test("generic painting request restores paint work if extractor omitted it", () => {
  const result = pruneImplicitWorks({
    message: "malowanie 20 m2",
    works: [
      { category: "painting", type: "project_design", quantity: 20 },
      { category: "painting", type: "preparation", quantity: 20 },
    ],
  });

  assert.deepEqual(result.works, [
    { category: "painting", type: "paint_2_layers", quantity: 20 },
  ]);
  assert.ok(
    result.warnings.some((warning) => warning.includes("paint_2_layers")),
  );
});
