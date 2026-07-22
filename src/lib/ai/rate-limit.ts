import "server-only";

export class SlidingAttemptLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  reserve(key: string, persistedCount: number, now = Date.now()) {
    const cutoff = now - this.windowMs;
    const recent = (this.buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (Math.max(persistedCount, recent.length) >= this.limit) {
      if (recent.length) this.buckets.set(key, recent);
      else this.buckets.delete(key);
      return false;
    }
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }
}

const globalForAiRateLimit = globalThis as typeof globalThis & { aiChatAttemptLimiter?: SlidingAttemptLimiter };

export const aiChatAttemptLimiter = globalForAiRateLimit.aiChatAttemptLimiter ?? new SlidingAttemptLimiter(10, 60_000);

if (process.env.NODE_ENV !== "production") globalForAiRateLimit.aiChatAttemptLimiter = aiChatAttemptLimiter;
