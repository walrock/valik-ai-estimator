function nowIso() {
  return new Date().toISOString();
}

function nowNs() {
  return process.hrtime.bigint();
}

function nsToSeconds(value) {
  return Number(value) / 1_000_000_000;
}

function toBackoffMs({ attemptNumber, baseMs, maxMs }) {
  const exponential = baseMs * 2 ** Math.max(0, attemptNumber - 1);
  return Math.min(maxMs, exponential);
}

function truncateError(error) {
  const text = error?.message ? String(error.message) : String(error);
  return text.slice(0, 500);
}

export class CrmOutboxProcessor {
  constructor({
    repository,
    crmClient,
    maxAttempts = 6,
    backoffBaseMs = 30_000,
    backoffMaxMs = 3_600_000,
    logger = console,
    metrics = null,
    alertHandler = null,
  }) {
    if (!repository || !crmClient) {
      throw new Error("repository and crmClient are required.");
    }

    this.repository = repository;
    this.crmClient = crmClient;
    this.maxAttempts = maxAttempts;
    this.backoffBaseMs = backoffBaseMs;
    this.backoffMaxMs = backoffMaxMs;
    this.logger = logger;
    this.metrics = metrics;
    this.alertHandler = typeof alertHandler === "function" ? alertHandler : null;
    this.isRunning = false;
  }

  async enqueueLead({ sessionId, leadDto, idempotencyKey = null }) {
    if (idempotencyKey && typeof this.repository.findByIdempotencyKey === "function") {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        this.metrics?.crmOutboxJobsTotal?.inc({ result: "deduped" }, 1);
        this.logger.info?.("crm_outbox_deduped", {
          session_id: sessionId,
          job_id: existing.id,
          idempotency_key: idempotencyKey,
          status: existing.status,
        });
        return existing;
      }
    }

    const job = await this.repository.createJob({
      type: "crm_lead",
      sessionId,
      idempotencyKey,
      payload: leadDto,
      nextAttemptAt: nowIso(),
    });

    this.metrics?.crmOutboxJobsTotal?.inc({ result: "enqueued" }, 1);
    this.logger.info?.("crm_outbox_enqueued", {
      session_id: sessionId,
      job_id: job.id,
      idempotency_key: idempotencyKey,
    });

    return job;
  }

  async processJob(jobId) {
    const job = await this.repository.getJob(jobId);
    if (!job || job.status !== "pending") {
      return { skipped: true, reason: "not_pending", job };
    }

    return this.#attemptDelivery(job);
  }

  async processPending({ limit = 20 } = {}) {
    const startedAtNs = nowNs();
    if (this.isRunning) {
      this.metrics?.crmOutboxProcessRunsTotal?.inc({ result: "skipped_running" }, 1);
      return { skipped: true, reason: "already_running", processed: 0, sent: 0, failed: 0 };
    }

    this.isRunning = true;
    try {
      const jobs = await this.repository.getProcessableJobs({ limit });
      let sent = 0;
      let failed = 0;

      for (const job of jobs) {
        const result = await this.#attemptDelivery(job);
        if (result.status === "sent") {
          sent += 1;
        } else if (result.status === "failed" || result.status === "pending") {
          failed += 1;
        }
      }

      return {
        skipped: false,
        processed: jobs.length,
        sent,
        failed,
      };
    } finally {
      const durationSeconds = nsToSeconds(nowNs() - startedAtNs);
      this.metrics?.crmOutboxProcessRunsTotal?.inc({ result: "completed" }, 1);
      this.metrics?.crmOutboxProcessDuration?.observe(
        { result: "completed" },
        durationSeconds,
      );
      this.isRunning = false;
    }
  }

  async listJobs(args) {
    return this.repository.listJobs(args);
  }

  async listDeadLetterJobs({ limit = 50 } = {}) {
    return this.repository.listJobs({ status: "failed", limit });
  }

  async close() {
    if (typeof this.repository.close === "function") {
      await this.repository.close();
    }
  }

  async #attemptDelivery(job) {
    try {
      const result = await this.crmClient.sendLead(job.payload, { dryRun: false });
      const updatedJob = await this.repository.markSent(job.id, result);
      this.metrics?.crmOutboxJobsTotal?.inc({ result: "sent" }, 1);
      this.logger.info?.("crm_outbox_sent", {
        job_id: job.id,
        session_id: job.sessionId,
        attempts: updatedJob?.attempts,
      });

      return { status: "sent", job: updatedJob, delivery: result };
    } catch (error) {
      const attemptNumber = job.attempts + 1;
      const isFinal = attemptNumber >= this.maxAttempts;
      const backoffMs = toBackoffMs({
        attemptNumber,
        baseMs: this.backoffBaseMs,
        maxMs: this.backoffMaxMs,
      });

      const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
      const errorMessage = truncateError(error);

      const updatedJob = await this.repository.markRetry(job.id, {
        errorMessage,
        nextAttemptAt,
        maxAttemptsReached: isFinal,
      });

      this.metrics?.crmOutboxJobsTotal?.inc(
        { result: isFinal ? "failed" : "retry_scheduled" },
        1,
      );
      this.logger.error?.("crm_outbox_delivery_failed", {
        job_id: job.id,
        session_id: job.sessionId,
        attempt: attemptNumber,
        max_attempts: this.maxAttempts,
        final: isFinal,
        error: errorMessage,
        next_attempt_at: updatedJob?.nextAttemptAt ?? null,
      });

      if (isFinal) {
        const alert = {
          job_id: job.id,
          session_id: job.sessionId,
          attempt: attemptNumber,
          max_attempts: this.maxAttempts,
          error: errorMessage,
          dead_letter_at: updatedJob?.deadLetterAt ?? nowIso(),
        };
        this.metrics?.crmOutboxDlqTotal?.inc({ reason: "max_attempts_reached" }, 1);
        this.logger.error?.("crm_outbox_dead_lettered", alert);

        if (this.alertHandler) {
          try {
            await this.alertHandler({
              type: "crm_outbox_dead_lettered",
              ...alert,
            });
          } catch (alertError) {
            this.logger.error?.("crm_outbox_alert_handler_failed", {
              job_id: job.id,
              error: truncateError(alertError),
            });
          }
        }
      }

      return { status: updatedJob?.status ?? "failed", job: updatedJob, error: errorMessage };
    }
  }
}
