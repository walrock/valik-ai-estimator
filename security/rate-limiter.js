export class MemoryRateLimiter {
  constructor({
    windowMs = 60_000,
    maxRequests = 60,
    sweepIntervalMs = 300_000,
  } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.sweepIntervalMs = sweepIntervalMs;
    this.buckets = new Map();
    this.lastSweepAt = Date.now();
  }

  check(key, now = Date.now()) {
    this.sweep(now);

    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      const next = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      this.buckets.set(key, next);

      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - next.count),
        resetAt: next.resetAt,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds,
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  sweep(now = Date.now()) {
    if (now - this.lastSweepAt < this.sweepIntervalMs) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    this.lastSweepAt = now;
  }
}
