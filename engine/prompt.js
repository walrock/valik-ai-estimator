import { describeCatalog } from "../domain/catalog.js";

export function buildExtractionPrompt() {
  return [
    "You are an assistant for a construction company.",
    "Extract work items from the user message.",
    "Return strict JSON only. No markdown and no comments.",
    "",
    "Expected JSON schema:",
    '{ "works": [ { "category": "string", "type": "string", "quantity": number } ] }',
    "",
    "Use only category/type values from this catalog:",
    describeCatalog(),
    "",
    "Rules:",
    "- quantity must be a positive number",
    "- if the user provides one area (for example 18m2), reuse it for all m2 works",
    "- do not default quantity to 1 when explicit area/count is present in the message",
    "- if you are not sure about a work item, skip it",
    "- never invent category/type names outside the catalog",
  ].join("\n");
}
