import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function nowIso() {
  return new Date().toISOString();
}

function buildEmptySession(sessionId) {
  const timestamp = nowIso();

  return {
    sessionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: null,
    status: "active",
    works: [],
    estimate: null,
    warnings: [],
    missingFields: [],
    questions: [],
    userMessages: [],
    lastUserMessage: "",
    language: "pl",
  };
}

function serializeJson(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function parseJson(value, fallback) {
  if (typeof value !== "string" || !value.length) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function ensureSessionLanguageColumn(db) {
  const columns = db.prepare("PRAGMA table_info(sessions)").all();
  const hasLanguageColumn = columns.some((column) => column.name === "language");

  if (!hasLanguageColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN language TEXT NOT NULL DEFAULT 'pl';");
  }
}

function rowToSession(row) {
  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    status: row.status,
    works: parseJson(row.works_json, []),
    estimate: parseJson(row.estimate_json, null),
    warnings: parseJson(row.warnings_json, []),
    missingFields: parseJson(row.missing_fields_json, []),
    questions: parseJson(row.questions_json, []),
    userMessages: parseJson(row.user_messages_json, []),
    lastUserMessage: row.last_user_message ?? "",
    language: row.language ?? "pl",
  };
}

function toDbParams(session) {
  return {
    session_id: session.sessionId,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    confirmed_at: session.confirmedAt ?? null,
    status: session.status,
    works_json: serializeJson(session.works, []),
    estimate_json: serializeJson(session.estimate, null),
    warnings_json: serializeJson(session.warnings, []),
    missing_fields_json: serializeJson(session.missingFields, []),
    questions_json: serializeJson(session.questions, []),
    user_messages_json: serializeJson(session.userMessages, []),
    last_user_message: session.lastUserMessage ?? "",
    language: session.language ?? "pl",
  };
}

export class SessionRepository {
  constructor({ filePath, dbPath, legacyFilePath } = {}) {
    this.dbPath = dbPath ?? filePath;
    if (!this.dbPath) {
      throw new Error("SessionRepository requires dbPath or filePath.");
    }

    this.legacyFilePath = legacyFilePath ?? null;
    this.db = null;
  }

  async init() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        status TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'pl',
        works_json TEXT NOT NULL,
        estimate_json TEXT,
        warnings_json TEXT NOT NULL,
        missing_fields_json TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        user_messages_json TEXT NOT NULL,
        last_user_message TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
      ON sessions(updated_at DESC);
    `);

    ensureSessionLanguageColumn(this.db);
    await this.maybeMigrateLegacyJson();
  }

  async maybeMigrateLegacyJson() {
    if (!this.legacyFilePath) {
      return;
    }

    const countRow = this.db
      .prepare("SELECT COUNT(1) AS count FROM sessions")
      .get();
    if ((countRow?.count ?? 0) > 0) {
      return;
    }

    let raw;
    try {
      raw = await fs.readFile(this.legacyFilePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }

      throw error;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return;
    }

    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    if (sessions.length === 0) {
      return;
    }

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        session_id, created_at, updated_at, confirmed_at, status,
        language,
        works_json, estimate_json, warnings_json, missing_fields_json,
        questions_json, user_messages_json, last_user_message
      ) VALUES (
        :session_id, :created_at, :updated_at, :confirmed_at, :status,
        :language,
        :works_json, :estimate_json, :warnings_json, :missing_fields_json,
        :questions_json, :user_messages_json, :last_user_message
      )
    `);

    this.db.exec("BEGIN");
    try {
      sessions.forEach((session) => {
        const normalized = {
          ...buildEmptySession(session.sessionId ?? randomUUID()),
          ...session,
        };
        insert.run(toDbParams(normalized));
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async createSession(initialData = {}) {
    const sessionId = initialData.sessionId ?? randomUUID();
    const session = {
      ...buildEmptySession(sessionId),
      ...initialData,
      sessionId,
      updatedAt: nowIso(),
    };

    await this.saveSession(session);
    return session;
  }

  async getSession(sessionId) {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get(sessionId);

    return rowToSession(row);
  }

  async saveSession(session) {
    if (!session?.sessionId) {
      throw new Error("sessionId is required.");
    }

    const updatedSession = {
      ...session,
      updatedAt: nowIso(),
    };

    this.db
      .prepare(`
        INSERT INTO sessions (
          session_id, created_at, updated_at, confirmed_at, status,
          language,
          works_json, estimate_json, warnings_json, missing_fields_json,
          questions_json, user_messages_json, last_user_message
        ) VALUES (
          :session_id, :created_at, :updated_at, :confirmed_at, :status,
          :language,
          :works_json, :estimate_json, :warnings_json, :missing_fields_json,
          :questions_json, :user_messages_json, :last_user_message
        )
        ON CONFLICT(session_id) DO UPDATE SET
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          confirmed_at = excluded.confirmed_at,
          status = excluded.status,
          language = excluded.language,
          works_json = excluded.works_json,
          estimate_json = excluded.estimate_json,
          warnings_json = excluded.warnings_json,
          missing_fields_json = excluded.missing_fields_json,
          questions_json = excluded.questions_json,
          user_messages_json = excluded.user_messages_json,
          last_user_message = excluded.last_user_message
      `)
      .run(toDbParams(updatedSession));

    return updatedSession;
  }

  async close() {
    if (!this.db) {
      return;
    }

    this.db.close();
    this.db = null;
  }
}
