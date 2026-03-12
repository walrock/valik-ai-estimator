import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClarifyingQuestions,
  detectMissingFields,
} from "../engine/clarifier.js";

test("clarifier asks for scope and quantity when input is too vague", () => {
  const missingFields = detectMissingFields({
    message: "Need renovation",
    works: [],
  });

  assert.ok(missingFields.includes("work_scope"));
  assert.ok(missingFields.includes("area_or_quantity"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier requests demolition context when lift/floor data is absent", () => {
  const missingFields = detectMissingFields({
    message: "Bathroom 8m2 in Warsaw",
    works: [{ category: "tiling", type: "demolition_no_lift", quantity: 8 }],
  });

  assert.ok(missingFields.includes("lift_access"));
  assert.ok(missingFields.includes("floor_number"));
});

test("clarifier does not require a deadline for a ready estimate", () => {
  const missingFields = detectMissingFields({
    message: "tile 30m2 in Gdansk",
    works: [{ category: "tiling", type: "tile_10_15", quantity: 30 }],
  });

  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier returns mapped questions for missing fields in Polish", () => {
  const questions = buildClarifyingQuestions(["area_or_quantity"], {
    language: "pl",
  });

  assert.deepEqual(questions, [
    "Podaj prosze powierzchnie w m2 lub ilosc sztuk dla kazdej pracy.",
  ]);
});

test("clarifier returns mapped questions for missing fields in English", () => {
  const questions = buildClarifyingQuestions(["area_or_quantity"], {
    language: "en",
  });

  assert.deepEqual(questions, [
    "Please provide area in m2 or item count for each work.",
  ]);
});

test("clarifier returns mapped questions for missing fields in Russian", () => {
  const questions = buildClarifyingQuestions(["area_or_quantity"], {
    language: "ru",
  });

  assert.deepEqual(questions, [
    "Укажите площадь в м2 или количество для каждой работы.",
  ]);
});
