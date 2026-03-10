import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function nowIso() {
  return new Date().toISOString();
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

function rowToJob(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    sessionId: row.session_id,
    idempotencyKey: row.idempotency_key ?? null,
    payload: parseJson(row.payload_json, null),
    status: row.status,
    attempts: row.attempts,
    maxAttemptsReached: Boolean(row.max_attempts_reached),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAttemptAt: row.last_attempt_at,
    lastSentAt: row.last_sent_at,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    deadLetterAt: row.dead_letter_at ?? null,
    deliveryMeta: parseJson(row.delivery_meta_json, null),
  };
}

function toDbParams(job) {
  return {
    id: job.id,
    type: job.type,
    session_id: job.sessionId ?? null,
    idempotency_key: job.idempotencyKey ?? null,
    payload_json: serializeJson(job.payload, null),
    status: job.status,
    attempts: job.attempts ?? 0,
    max_attempts_reached: job.maxAttemptsReached ? 1 : 0,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    last_attempt_at: job.lastAttemptAt ?? null,
    last_sent_at: job.lastSentAt ?? null,
    last_error: job.lastError ?? null,
    next_attempt_at: job.nextAttemptAt ?? null,
    dead_letter_at: job.deadLetterAt ?? null,
    delivery_meta_json: serializeJson(job.deliveryMeta, null),
  };
}

export class OutboxRepository {
  constructor({ filePath, dbPath, legacyFilePath } = {}) {
    this.dbPath = dbPath ?? filePath;
    if (!this.dbPath) {
      throw new Error("OutboxRepository requires dbPath or filePath.");
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

      CREATE TABLE IF NOT EXISTS outbox_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        session_id TEXT,
        idempotency_key TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts_reached INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_attempt_at TEXT,
        last_sent_at TEXT,
        last_error TEXT,
        next_attempt_at TEXT,
        dead_letter_at TEXT,
        delivery_meta_json TEXT
      );
    `);
    await this.ensureSchemaCompat();

    await this.maybeMigrateLegacyJson();
  }

  async ensureSchemaCompat() {
    const columns = new Set(
      this.db
        .prepare("PRAGMA table_info(outbox_jobs)")
        .all()
        .map((column) => column.name),
    );

    if (!columns.has("idempotency_key")) {
      this.db.exec("ALTER TABLE outbox_jobs ADD COLUMN idempotency_key TEXT;");
    }

    if (!columns.has("dead_letter_at")) {
      this.db.exec("ALTER TABLE outbox_jobs ADD COLUMN dead_letter_at TEXT;");
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt
      ON outbox_jobs(status, next_attempt_at);

      CREATE INDEX IF NOT EXISTS idx_outbox_updated_at
      ON outbox_jobs(updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_outbox_dead_letter_at
      ON outbox_jobs(dead_letter_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_idempotency_key
      ON outbox_jobs(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    `);
  }

  async maybeMigrateLegacyJson() {
    if (!this.legacyFilePath) {
      return;
    }

    const countRow = this.db
      .prepare("SELECT COUNT(1) AS count FROM outbox_jobs")
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

    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    if (jobs.length === 0) {
      return;
    }

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO outbox_jobs (
        id, type, session_id, idempotency_key, payload_json, status, attempts,
        max_attempts_reached, created_at, updated_at, last_attempt_at,
        last_sent_at, last_error, next_attempt_at, dead_letter_at, delivery_meta_json
      ) VALUES (
        :id, :type, :session_id, :idempotency_key, :payload_json, :status, :attempts,
        :max_attempts_reached, :created_at, :updated_at, :last_attempt_at,
        :last_sent_at, :last_error, :next_attempt_at, :dead_letter_at, :delivery_meta_json
      )
    `);

    this.db.exec("BEGIN");
    try {
      jobs.forEach((job) => {
        const normalized = {
          id: job.id ?? randomUUID(),
          type: job.type ?? "crm_lead",
          sessionId: job.sessionId ?? null,
          idempotencyKey: job.idempotencyKey ?? null,
          payload: job.payload ?? null,
          status: job.status ?? "pending",
          attempts: Number(job.attempts ?? 0),
          maxAttemptsReached: Boolean(job.maxAttemptsReached),
          createdAt: job.createdAt ?? nowIso(),
          updatedAt: job.updatedAt ?? nowIso(),
          lastAttemptAt: job.lastAttemptAt ?? null,
          lastSentAt: job.lastSentAt ?? null,
          lastError: job.lastError ?? null,
          nextAttemptAt: job.nextAttemptAt ?? nowIso(),
          deadLetterAt: job.deadLetterAt ?? null,
          deliveryMeta: job.deliveryMeta ?? null,
        };

        insert.run(toDbParams(normalized));
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async createJob({
    type = "crm_lead",
    sessionId,
    idempotencyKey = null,
    payload,
    nextAttemptAt = nowIso(),
  }) {
    const timestamp = nowIso();
    const job = {
      id: randomUUID(),
      type,
      sessionId,
      idempotencyKey,
      payload,
      status: "pending",
      attempts: 0,
      maxAttemptsReached: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAttemptAt: null,
      lastSentAt: null,
      lastError: null,
      nextAttemptAt,
      deadLetterAt: null,
      deliveryMeta: null,
    };

    try {
      this.db
        .prepare(`
          INSERT INTO outbox_jobs (
            id, type, session_id, idempotency_key, payload_json, status, attempts,
            max_attempts_reached, created_at, updated_at, last_attempt_at,
            last_sent_at, last_error, next_attempt_at, dead_letter_at, delivery_meta_json
          ) VALUES (
            :id, :type, :session_id, :idempotency_key, :payload_json, :status, :attempts,
            :max_attempts_reached, :created_at, :updated_at, :last_attempt_at,
            :last_sent_at, :last_error, :next_attempt_at, :dead_letter_at, :delivery_meta_json
          )
        `)
        .run(toDbParams(job));
    } catch (error) {
      const message = String(error?.message ?? "");
      if (
        idempotencyKey &&
        message.includes("UNIQUE constraint failed") &&
        message.includes("outbox_jobs.idempotency_key")
      ) {
        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          return existing;
        }
      }

      throw error;
    }

    return job;
  }

  async findByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) {
      return null;
    }

    const row = this.db
      .prepare("SELECT * FROM outbox_jobs WHERE idempotency_key = ?")
      .get(idempotencyKey);
    return rowToJob(row);
  }

  async getJob(id) {
    const row = this.db
      .prepare("SELECT * FROM outbox_jobs WHERE id = ?")
      .get(id);

    return rowToJob(row);
  }

  async listJobs({ status, limit = 50 } = {}) {
    const safeLimit = Math.max(0, limit);
    let rows;

    if (status) {
      rows = this.db
        .prepare(
          `
          SELECT * FROM outbox_jobs
          WHERE status = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `,
        )
        .all(status, safeLimit);
    } else {
      rows = this.db
        .prepare(
          `
          SELECT * FROM outbox_jobs
          ORDER BY updated_at DESC
          LIMIT ?
        `,
        )
        .all(safeLimit);
    }

    return rows.map(rowToJob);
  }

  async getProcessableJobs({ now = nowIso(), limit = 20 } = {}) {
    const safeLimit = Math.max(0, limit);
    const rows = this.db
      .prepare(
        `
        SELECT * FROM outbox_jobs
        WHERE status = 'pending'
          AND next_attempt_at IS NOT NULL
          AND next_attempt_at <= ?
        ORDER BY next_attempt_at ASC
        LIMIT ?
      `,
      )
      .all(now, safeLimit);

    return rows.map(rowToJob);
  }

  async markSent(id, deliveryMeta = {}) {
    const job = await this.getJob(id);
    if (!job) {
      return null;
    }

    const timestamp = nowIso();
    const updatedJob = {
      ...job,
      status: "sent",
      updatedAt: timestamp,
      lastAttemptAt: timestamp,
      lastSentAt: timestamp,
      attempts: job.attempts + 1,
      lastError: null,
      maxAttemptsReached: false,
      nextAttemptAt: null,
      deadLetterAt: null,
      deliveryMeta,
    };

    this.db
      .prepare(`
        UPDATE outbox_jobs SET
          status = :status,
          attempts = :attempts,
          max_attempts_reached = :max_attempts_reached,
          updated_at = :updated_at,
          last_attempt_at = :last_attempt_at,
          last_sent_at = :last_sent_at,
          last_error = :last_error,
          next_attempt_at = :next_attempt_at,
          dead_letter_at = :dead_letter_at,
          delivery_meta_json = :delivery_meta_json
        WHERE id = :id
      `)
      .run({
        id: updatedJob.id,
        status: updatedJob.status,
        attempts: updatedJob.attempts,
        max_attempts_reached: updatedJob.maxAttemptsReached ? 1 : 0,
        updated_at: updatedJob.updatedAt,
        last_attempt_at: updatedJob.lastAttemptAt,
        last_sent_at: updatedJob.lastSentAt,
        last_error: updatedJob.lastError,
        next_attempt_at: updatedJob.nextAttemptAt,
        dead_letter_at: updatedJob.deadLetterAt,
        delivery_meta_json: serializeJson(updatedJob.deliveryMeta, null),
      });

    return updatedJob;
  }

  async markRetry(id, { errorMessage, nextAttemptAt, maxAttemptsReached = false }) {
    const job = await this.getJob(id);
    if (!job) {
      return null;
    }

    const timestamp = nowIso();
    const updatedJob = {
      ...job,
      status: maxAttemptsReached ? "failed" : "pending",
      attempts: job.attempts + 1,
      maxAttemptsReached,
      updatedAt: timestamp,
      lastAttemptAt: timestamp,
      lastError: errorMessage,
      nextAttemptAt: maxAttemptsReached ? null : nextAttemptAt,
      deadLetterAt: maxAttemptsReached ? timestamp : null,
    };

    this.db
      .prepare(`
        UPDATE outbox_jobs SET
          status = :status,
          attempts = :attempts,
          max_attempts_reached = :max_attempts_reached,
          updated_at = :updated_at,
          last_attempt_at = :last_attempt_at,
          last_error = :last_error,
          next_attempt_at = :next_attempt_at,
          dead_letter_at = :dead_letter_at
        WHERE id = :id
      `)
      .run({
        id: updatedJob.id,
        status: updatedJob.status,
        attempts: updatedJob.attempts,
        max_attempts_reached: updatedJob.maxAttemptsReached ? 1 : 0,
        updated_at: updatedJob.updatedAt,
        last_attempt_at: updatedJob.lastAttemptAt,
        last_error: updatedJob.lastError,
        next_attempt_at: updatedJob.nextAttemptAt,
        dead_letter_at: updatedJob.deadLetterAt,
      });

    return updatedJob;
  }

  async close() {
    if (!this.db) {
      return;
    }

    this.db.close();
    this.db = null;
  }
}
