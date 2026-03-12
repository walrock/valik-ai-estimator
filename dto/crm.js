import { z } from "zod";

const BreakdownItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const CrmLeadSchema = z.object({
  source: z.literal("valik-ai-estimator"),
  sessionId: z.string().min(1),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  status: z.enum(["active", "needs_clarification", "ready_for_confirmation", "confirmed"]),
  customer: z.object({
    city: z.string().nullable(),
    timeline: z.string().nullable(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    note: z.string().nullable(),
  }),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  transcript: z.array(z.string()),
  estimate: z.object({
    currency: z.literal("PLN"),
    subtotal: z.number().nonnegative(),
    total: z.number().nonnegative(),
    appliedRules: z.array(z.string()),
    warnings: z.array(z.string()),
    breakdown: z.array(BreakdownItemSchema),
  }),
});

const CITY_ALIASES = [
  {
    value: "Gdansk",
    pattern:
      /\b(gda(?:n|\u0144)sk|\u0413\u0434\u0430\u043d\u044c\u0441\u043a|\u0413\u0434\u0430\u043d\u0441\u043a)\b/iu,
  },
  {
    value: "Gdynia",
    pattern: /\b(gdynia|\u0413\u0434\u044b\u043d\u044f)\b/iu,
  },
  {
    value: "Sopot",
    pattern: /\b(sopot|\u0421\u043e\u043f\u043e\u0442)\b/iu,
  },
  {
    value: "Trojmiasto",
    pattern:
      /\b(tr[o\u00f3]jmiasto|trojmiasto|tri[-\s]?city|\u0422\u0440\u043e\u0439\u043c\u044f\u0441\u0442\u043e)\b/iu,
  },
  {
    value: "Warszawa",
    pattern: /\b(warsaw|warszawa|\u0412\u0430\u0440\u0448\u0430\u0432\u0430)\b/iu,
  },
  {
    value: "Krakow",
    pattern: /\b(krakow|krak\u00f3w|\u041a\u0440\u0430\u043a\u043e\u0432)\b/iu,
  },
  {
    value: "Wroclaw",
    pattern: /\b(wroclaw|wroc\u0142aw|\u0412\u0440\u043e\u0446\u043b\u0430\u0432)\b/iu,
  },
  {
    value: "Poznan",
    pattern: /\b(poznan|pozna\u0144|\u041f\u043e\u0437\u043d\u0430\u043d\u044c)\b/iu,
  },
  {
    value: "Lodz",
    pattern: /\b(lodz|\u0142\u00f3d\u017a|\u041b\u043e\u0434\u0437\u044c)\b/iu,
  },
  {
    value: "Berlin",
    pattern: /\b(berlin|\u0411\u0435\u0440\u043b\u0438\u043d)\b/iu,
  },
  {
    value: "Munich",
    pattern: /\b(munich|m\u00fcnchen|\u041c\u044e\u043d\u0445\u0435\u043d)\b/iu,
  },
  {
    value: "London",
    pattern: /\b(london|\u041b\u043e\u043d\u0434\u043e\u043d)\b/iu,
  },
  {
    value: "Paris",
    pattern: /\b(paris|\u041f\u0430\u0440\u0438\u0436)\b/iu,
  },
];

const TIMELINE_PATTERN =
  /\b(asap|urgent|tomorrow|next week|next month|\d+\s*(?:day|days|week|weeks|month|months)|pilne|szybko|jutro|pojutrze|w tym tygodniu|w przysz(?:\u0142|l)ym tygodniu|w przysz(?:\u0142|l)ym miesi(?:\u0105|a)cu|za\s+\d+\s*(?:dzien|dni|tydzien|tygodnie|tygodni|miesiac|miesiace|miesiecy)|\u0441\u0440\u043e\u0447\u043d\u043e|\u0441\u0435\u0433\u043e\u0434\u043d\u044f|\u0441\u0435\u0439\u0447\u0430\u0441|\u0437\u0430\u0432\u0442\u0440\u0430|\u043f\u043e\u0441\u043b\u0435\u0437\u0430\u0432\u0442\u0440\u0430|\u043d\u0430 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u043d\u0435\u0434\u0435\u043b\u0435|\u043d\u0430 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u043c \u043c\u0435\u0441\u044f\u0446\u0435|\u0447\u0435\u0440\u0435\u0437\s+\d+\s*(?:\u0434\u0435\u043d\u044c|\u0434\u043d\u044f|\u0434\u043d\u0435\u0439|\u043d\u0435\u0434\u0435\u043b[\u044f\u0438\u044e\u0435]|\u043c\u0435\u0441\u044f\u0446|\u043c\u0435\u0441\u044f\u0446\u0430|\u043c\u0435\u0441\u044f\u0446\u0435\u0432))\b/iu;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/g;
const NOTE_HINT_PATTERN =
  /(call\s+me|please\s+call|oddzwon|oddzwo(?:n|\u0144)|zadzwon|zadzwo(?:n|\u0144)|tel\.?|telefon|kontakt|mail|email|\u043f\u043e\u0437\u0432\u043e\u043d|\u043f\u0435\u0440\u0435\u0437\u0432\u043e\u043d|\u0441\u0432\u044f\u0437\u0430\u0442\u044c|\u043a\u043e\u043d\u0442\u0430\u043a\u0442)/iu;

function extractCity(messages) {
  for (const message of messages) {
    for (const alias of CITY_ALIASES) {
      const match = message.match(alias.pattern);
      if (match) {
        return match[0];
      }
    }
  }

  return null;
}

function extractTimeline(messages) {
  for (const message of messages) {
    const match = message.match(TIMELINE_PATTERN);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function extractEmail(messages) {
  for (const message of messages) {
    const match = message.match(EMAIL_PATTERN);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function normalizePhone(raw) {
  if (!raw) {
    return null;
  }

  const trimmed = String(raw).trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return `${hasPlus ? "+" : ""}${digits}`;
}

function extractPhone(messages) {
  for (const message of messages) {
    const matches = String(message).matchAll(PHONE_PATTERN);
    for (const match of matches) {
      const normalized = normalizePhone(match[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function extractNote(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = String(messages[i] ?? "").trim();
    if (!message) {
      continue;
    }
    if (NOTE_HINT_PATTERN.test(message)) {
      return message;
    }
  }

  return null;
}

export function buildCrmLeadDto(session) {
  const transcript = Array.isArray(session.userMessages) ? session.userMessages : [];
  const estimate = session.estimate ?? {
    subtotal: 0,
    total: 0,
    appliedRules: [],
    warnings: [],
    breakdown: [],
  };

  const payload = {
    source: "valik-ai-estimator",
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    confirmedAt: session.confirmedAt ?? null,
    status: session.status,
    customer: {
      city: extractCity(transcript),
      timeline: extractTimeline(transcript),
      name: null,
      email: extractEmail(transcript),
      phone: extractPhone(transcript),
      note: extractNote(transcript),
    },
    missingFields: session.missingFields ?? [],
    warnings: session.warnings ?? [],
    transcript,
    estimate: {
      currency: "PLN",
      subtotal: estimate.subtotal ?? 0,
      total: estimate.total ?? 0,
      appliedRules: estimate.appliedRules ?? [],
      warnings: estimate.warnings ?? [],
      breakdown: estimate.breakdown ?? [],
    },
  };

  return CrmLeadSchema.parse(payload);
}
