export const LEAD_WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.converted",
  "lead.deleted",
  "webhook.test"
] as const;

export type LeadWebhookEvent = (typeof LEAD_WEBHOOK_EVENTS)[number];

export const WEBHOOK_MAX_ATTEMPTS = 6;
export const WEBHOOK_AUTO_DISABLE_FAILURES = 20;
export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_CLAIM_MS = 20_000;

/** Delay before the next attempt after the Nth failed attempt (1-based). */
export const WEBHOOK_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000] as const;

export function nextWebhookAttemptAt(attempts: number, now = new Date()) {
  const delay = WEBHOOK_BACKOFF_MS[Math.max(0, attempts - 1)] ?? WEBHOOK_BACKOFF_MS.at(-1)!;
  return new Date(now.getTime() + delay);
}

export function webhookAttemptsExhausted(attempts: number) {
  return attempts >= WEBHOOK_MAX_ATTEMPTS;
}

export function shouldDisableWebhook(consecutiveFailures: number) {
  return consecutiveFailures >= WEBHOOK_AUTO_DISABLE_FAILURES;
}
