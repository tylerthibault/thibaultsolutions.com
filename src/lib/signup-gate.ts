import { createHash, timingSafeEqual } from "node:crypto";

type Entry = { attempts: number; resetAt: number };
const attempts = new Map<string, Entry>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function signupPinConfigured() {
  return Boolean(process.env.CREATIVE_CIRCLE_SIGNUP_PIN);
}

export function signupPinMatches(supplied: string) {
  const expected = process.env.CREATIVE_CIRCLE_SIGNUP_PIN;
  if (!expected) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function signupRateLimitKey(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function checkSignupRateLimit(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { attempts: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.attempts >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedSignupPin(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.attempts += 1;
  attempts.set(key, current);
}

export function clearSignupPinFailures(key: string) {
  attempts.delete(key);
}
