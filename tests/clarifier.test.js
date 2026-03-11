import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClarifyingQuestions,
  detectMissingFields,
} from "../engine/clarifier.js";

test("clarifier asks for scope and deadline when input is too vague", () => {
  const missingFields = detectMissingFields({
    message: "Need renovation",
    works: [],
  });

  assert.ok(missingFields.includes("work_scope"));
  assert.ok(missingFields.includes("deadline"));
});

test("clarifier requests demolition context when lift/floor data is absent", () => {
  const missingFields = detectMissingFields({
    message: "Bathroom 8m2 in Warsaw",
    works: [{ category: "tiling", type: "demolition_no_lift", quantity: 8 }],
  });

  assert.ok(missingFields.includes("lift_access"));
  assert.ok(missingFields.includes("floor_number"));
});

test("clarifier returns mapped questions for missing fields", () => {
  const questions = buildClarifyingQuestions(["deadline", "city"]);

  assert.deepEqual(questions, [
    "Jaki jest planowany termin rozpoczęcia lub deadline realizacji?",
    "W jakim mieście znajduje się inwestycja?",
  ]);
});
