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

test("clarifier recognizes Russian city names for Polish cities", () => {
  const missingFields = detectMissingFields({
    message: "Нужно плитка 6 м2 в гданьске, старт завтра",
    works: [{ category: "tiling", type: "tile_10_15", quantity: 6 }],
  });

  assert.ok(!missingFields.includes("city"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier recognizes Russian demolition details with city and floor forms", () => {
  const missingFields = detectMissingFields({
    message: "Демонтаж 5 м2 в варшаве, на 3 этаже, без лифта, завтра",
    works: [{ category: "tiling", type: "demolition_no_lift", quantity: 5 }],
  });

  assert.ok(!missingFields.includes("city"));
  assert.ok(!missingFields.includes("floor_number"));
  assert.ok(!missingFields.includes("lift_access"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier recognizes Russian duration with explicit start date", () => {
  const missingFields = detectMissingFields({
    message: "покраска 460м2, город гданьск, скрок 2 месяца с 20 марта",
    works: [{ category: "painting", type: "paint_2_layers", quantity: 460 }],
  });

  assert.ok(!missingFields.includes("city"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier recognizes numeric deadline date formats with keyword", () => {
  const missingFields = detectMissingFields({
    message: "tile 30m2 in Gdansk, deadline 20.03.2026",
    works: [{ category: "tiling", type: "tile_10_15", quantity: 30 }],
  });

  assert.ok(!missingFields.includes("city"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier recognizes conversational Russian timeline phrases", () => {
  const missingFields = detectMissingFields({
    message: "покраска стен 20м2, гданьск, начать можно сейчас, срок пару дней",
    works: [{ category: "painting", type: "paint_2_layers", quantity: 20 }],
  });

  assert.ok(!missingFields.includes("city"));
  assert.ok(!missingFields.includes("deadline"));
});

test("clarifier returns mapped questions for missing fields in Polish", () => {
  const questions = buildClarifyingQuestions(["deadline"], {
    language: "pl",
  });

  assert.deepEqual(questions, [
    "Jaki jest planowany termin rozpoczecia lub deadline realizacji?",
  ]);
});

test("clarifier returns mapped questions for missing fields in English", () => {
  const questions = buildClarifyingQuestions(["deadline"], {
    language: "en",
  });

  assert.deepEqual(questions, [
    "What is the expected start date or deadline for the project?",
  ]);
});

test("clarifier returns mapped questions for missing fields in Russian", () => {
  const questions = buildClarifyingQuestions(["deadline"], {
    language: "ru",
  });

  assert.deepEqual(questions, [
    "Какой планируемый срок начала или дедлайн проекта?",
  ]);
});
