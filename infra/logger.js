const LEVEL_PRIORITIES = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

function normalizeLevel(level) {
  const normalized = String(level ?? "info").toLowerCase();
  if (!LEVEL_PRIORITIES[normalized]) {
    return "info";
  }

  return normalized;
}

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }

    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack,
      };
    }

    return val;
  });
}

export function createLogger({
  service = "valik-ai-estimator",
  level = process.env.LOG_LEVEL ?? "info",
  sink = process.stdout,
  context = {},
} = {}) {
  const threshold = LEVEL_PRIORITIES[normalizeLevel(level)];

  function shouldLog(targetLevel) {
    return LEVEL_PRIORITIES[targetLevel] >= threshold;
  }

  function emit(targetLevel, event, fields = {}) {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level: targetLevel,
      service,
      event: String(event ?? "log"),
      ...context,
      ...fields,
    };

    sink.write(`${safeStringify(entry)}\n`);
  }

  function buildChild(extraContext = {}) {
    return createLogger({
      service,
      level,
      sink,
      context: { ...context, ...extraContext },
    });
  }

  return {
    debug(event, fields = {}) {
      emit("debug", event, fields);
    },
    info(event, fields = {}) {
      emit("info", event, fields);
    },
    warn(event, fields = {}) {
      emit("warn", event, fields);
    },
    error(event, fields = {}) {
      emit("error", event, fields);
    },
    child(extraContext = {}) {
      return buildChild(extraContext);
    },
  };
}
