import { afterEach, describe, expect, it } from "vitest";
import { signupPinConfigured, signupPinMatches } from "../src/lib/signup-gate";

const original = process.env.CREATIVE_CIRCLE_SIGNUP_PIN;

afterEach(() => {
  if (original === undefined) delete process.env.CREATIVE_CIRCLE_SIGNUP_PIN;
  else process.env.CREATIVE_CIRCLE_SIGNUP_PIN = original;
});

describe("Creative Circle signup PIN", () => {
  it("is disabled when the PIN env var is absent", () => {
    delete process.env.CREATIVE_CIRCLE_SIGNUP_PIN;
    expect(signupPinConfigured()).toBe(false);
    expect(signupPinMatches("123456")).toBe(false);
  });

  it("accepts only the configured PIN", () => {
    process.env.CREATIVE_CIRCLE_SIGNUP_PIN = "735194";
    expect(signupPinConfigured()).toBe(true);
    expect(signupPinMatches("735194")).toBe(true);
    expect(signupPinMatches("735195")).toBe(false);
  });
});
