const URL_REGEX = /https?:\/\/\S+/gi;

function normalizeMessage(message) {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

export class MessageSpamGuard {
  constructor({
    maxLength = 1200,
    minIntervalMs = 1200,
    duplicateWindowMs = 15_000,
    maxDuplicateBursts = 2,
    maxUrls = 3,
    repeatedCharThreshold = 18,
    stateTtlMs = 1_800_000,
  } = {}) {
    this.maxLength = maxLength;
    this.minIntervalMs = minIntervalMs;
    this.duplicateWindowMs = duplicateWindowMs;
    this.maxDuplicateBursts = maxDuplicateBursts;
    this.maxUrls = maxUrls;
    this.repeatedCharThreshold = repeatedCharThreshold;
    this.stateTtlMs = stateTtlMs;
    this.states = new Map();
    this.lastSweepAt = Date.now();
  }

  inspect({ key, message, now = Date.now() }) {
    const text = String(message ?? "").trim();
    if (!text) {
      return { ok: false, statusCode: 400, error: "message is required." };
    }

    if (text.length > this.maxLength) {
      return {
        ok: false,
        statusCode: 413,
        error: `message is too long (max ${this.maxLength} chars).`,
      };
    }

    const repeatedPattern = new RegExp(`(.)\\1{${this.repeatedCharThreshold},}`, "u");
    if (repeatedPattern.test(text)) {
      return {
        ok: false,
        statusCode: 422,
        error: "message looks like spam (repeated characters).",
      };
    }

    const urls = text.match(URL_REGEX) ?? [];
    if (urls.length > this.maxUrls) {
      return {
        ok: false,
        statusCode: 422,
        error: "message contains too many URLs.",
      };
    }

    this.sweep(now);

    const normalized = normalizeMessage(text);
    const state = this.states.get(key) ?? {
      lastAt: 0,
      lastMessage: "",
      duplicateBursts: 0,
    };

    const delta = now - state.lastAt;
    if (state.lastAt > 0 && delta < this.minIntervalMs) {
      return {
        ok: false,
        statusCode: 429,
        error: "messages are sent too quickly.",
        retryAfterSeconds: Math.max(1, Math.ceil((this.minIntervalMs - delta) / 1000)),
      };
    }

    if (
      normalized === state.lastMessage &&
      state.lastAt > 0 &&
      now - state.lastAt <= this.duplicateWindowMs
    ) {
      state.duplicateBursts += 1;
      if (state.duplicateBursts >= this.maxDuplicateBursts) {
        state.lastAt = now;
        this.states.set(key, state);
        return {
          ok: false,
          statusCode: 429,
          error: "duplicate messages detected.",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(this.duplicateWindowMs / 1000),
          ),
        };
      }
    } else {
      state.duplicateBursts = 0;
    }

    state.lastAt = now;
    state.lastMessage = normalized;
    this.states.set(key, state);

    return { ok: true };
  }

  sweep(now = Date.now()) {
    if (now - this.lastSweepAt < this.stateTtlMs) {
      return;
    }

    for (const [key, state] of this.states.entries()) {
      if (now - state.lastAt > this.stateTtlMs) {
        this.states.delete(key);
      }
    }

    this.lastSweepAt = now;
  }
}
