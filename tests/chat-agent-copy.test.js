import test from "node:test";
import assert from "node:assert/strict";
import { createStaticExtractor } from "../services/extractor.js";
import { createChatAgent } from "../services/chat-agent.js";

test("chat agent uses AI-composed reply when composer returns text", async () => {
  const extractWorks = createStaticExtractor(() => ({
    works: [{ category: "painting", type: "paint_2_layers", quantity: 12 }],
  }));
  const composeAssistantMessage = async () => "Custom assistant copy";
  const agent = createChatAgent({ extractWorks, composeAssistantMessage });

  const session = {
    sessionId: "session-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    works: [],
    missingFields: [],
    lastUserMessage: "",
    userMessages: [],
    questions: [],
    warnings: [],
    estimate: null,
    confirmedAt: null,
    language: "en",
  };

  const result = await agent.processMessage({
    session,
    message: "Bathroom 12m2 painting",
  });

  assert.match(result.response.assistantMessage, /Custom assistant copy/);
  assert.match(result.response.assistantMessage, /Great,/);
});

test("chat agent adds direct answer for pricing questions before clarification", async () => {
  const extractWorks = createStaticExtractor(() => ({ works: [] }));
  const composeAssistantMessage = async () => "I need a few more details.";
  const agent = createChatAgent({ extractWorks, composeAssistantMessage });

  const session = {
    sessionId: "session-qa-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    works: [],
    missingFields: [],
    lastUserMessage: "",
    userMessages: [],
    questions: [],
    warnings: [],
    estimate: null,
    confirmedAt: null,
    language: "en",
  };

  const result = await agent.processMessage({
    session,
    message: "How is price calculated?",
  });

  assert.equal(result.response.language, "en");
  assert.match(
    result.response.assistantMessage,
    /Pricing is calculated from work scope and quantities/i,
  );
  assert.match(result.response.assistantMessage, /I need a few more details/i);
});

test("chat agent falls back to template reply when composer fails", async () => {
  const extractWorks = createStaticExtractor(() => ({ works: [] }));
  const composeAssistantMessage = async () => {
    throw new Error("temporary provider error");
  };
  const agent = createChatAgent({ extractWorks, composeAssistantMessage });

  const session = {
    sessionId: "session-2",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    works: [],
    missingFields: [],
    lastUserMessage: "",
    userMessages: [],
    questions: [],
    warnings: [],
    estimate: null,
    confirmedAt: null,
    language: "pl",
  };

  const result = await agent.processMessage({
    session,
    message: "Hello, I need estimate for kitchen",
  });

  assert.equal(result.response.language, "en");
  assert.match(result.response.assistantMessage, /I need a few more details/i);
});

test("chat agent handles service scope questions in Russian", async () => {
  const extractWorks = createStaticExtractor(() => ({ works: [] }));
  const composeAssistantMessage = async () => "Черновая смета готова.";
  const agent = createChatAgent({ extractWorks, composeAssistantMessage });

  const session = {
    sessionId: "session-scope-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    works: [{ category: "painting", type: "paint_2_layers", quantity: 10 }],
    missingFields: [],
    lastUserMessage: "",
    userMessages: [],
    questions: [],
    warnings: [],
    estimate: {
      subtotal: 250,
      total: 1000,
      breakdown: [],
      warnings: [],
      appliedRules: ["minimum_order"],
    },
    confirmedAt: null,
    language: "ru",
  };

  const result = await agent.processMessage({
    session,
    message: "А машины вы красите?",
  });

  assert.equal(result.response.language, "ru");
  assert.match(result.response.assistantMessage, /не занимаемся покраской автомобилей/i);
});

test("chat agent keeps session confirmed after additional user messages", async () => {
  const extractWorks = createStaticExtractor(() => ({
    works: [{ category: "tiling", type: "tile_10_15", quantity: 5 }],
  }));
  const composeAssistantMessage = async () => "Should not be used";
  const agent = createChatAgent({ extractWorks, composeAssistantMessage });

  const session = {
    sessionId: "session-confirmed-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "confirmed",
    works: [{ category: "painting", type: "paint_2_layers", quantity: 20 }],
    missingFields: [],
    lastUserMessage: "",
    userMessages: ["old message"],
    questions: [],
    warnings: [],
    estimate: {
      subtotal: 500,
      total: 1000,
      breakdown: [],
      warnings: [],
      appliedRules: ["minimum_order"],
    },
    confirmedAt: new Date().toISOString(),
    language: "ru",
  };

  const result = await agent.processMessage({
    session,
    message: "а машины вы красите?",
  });

  assert.equal(result.response.status, "confirmed");
  assert.equal(result.response.language, "ru");
  assert.match(result.response.assistantMessage, /уже подтверждена/i);
  assert.deepEqual(result.response.missingFields, []);
});
