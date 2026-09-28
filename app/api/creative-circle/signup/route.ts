import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuth } from "@/src/lib/auth";
import {
  checkSignupRateLimit,
  clearSignupPinFailures,
  recordFailedSignupPin,
  signupPinConfigured,
  signupPinMatches,
  signupRateLimitKey,
} from "@/src/lib/signup-gate";

export const runtime = "nodejs";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  pin: z.string().min(4).max(128),
});

const signupAuth = createAuth(false);

export async function POST(request: Request) {
  if (!signupPinConfigured()) {
    return NextResponse.json({ error: "Signup is not configured." }, { status: 503 });
  }

  const key = signupRateLimitKey(request.headers);
  const limit = checkSignupRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many incorrect PIN attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your name, email, password, and PIN." }, { status: 400 });
  }

  const { pin, ...account } = parsed.data;
  if (!signupPinMatches(pin)) {
    recordFailedSignupPin(key);
    return NextResponse.json({ error: "Invalid access PIN." }, { status: 403 });
  }

  clearSignupPinFailures(key);

  try {
    await signupAuth.api.signUpEmail({
      body: {
        name: account.name,
        email: account.email,
        password: account.password,
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/exist|already|duplicate/i.test(message)) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("Creative Circle signup failed", error);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
