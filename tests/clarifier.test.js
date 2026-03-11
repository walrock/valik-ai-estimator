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

test("clarifier returns mapped questions for missing fields in Polish", () => {
  const questions = buildClarifyingQuestions(["deadline", "city"], {
    language: "pl",
  });

  assert.deepEqual(questions, [
    "Jaki jest planowany termin rozpoczecia lub deadline realizacji?",
    "W jakim miescie znajduje sie inwestycja?",
  ]);
});

test("clarifier returns mapped questions for missing fields in English", () => {
  const questions = buildClarifyingQuestions(["deadline", "city"], {
    language: "en",
  });

  assert.deepEqual(questions, [
    "What is the expected start date or deadline for the project?",
    "In which city is the project located?",
  ]);
});

test("clarifier returns mapped questions for missing fields in Russian", () => {
  const questions = buildClarifyingQuestions(["deadline", "city"], {
    language: "ru",
  });

  assert.deepEqual(questions, [
    "Какой планируемый срок начала или дедлайн проекта?",
    "В каком городе находится объект?",
  ]);
});
