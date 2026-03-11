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
    language: "pl",
  };

  const result = await agent.processMessage({
    session,
    message: "Bathroom 12m2 painting",
  });

  assert.match(result.response.assistantMessage, /Custom assistant copy/);
  assert.match(result.response.assistantMessage, /Great,/);
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
