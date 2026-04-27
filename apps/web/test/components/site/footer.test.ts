/**
 * Footer — smoke import + pure logic (no DOM rendering; bun:test env has no jsdom)
 *
 * Covers:
 *  - module imports cleanly
 *  - validateEmail accepts valid emails (and trims/lowercases)
 *  - validateEmail rejects invalid/empty/too-long input
 */
import { describe, expect, it } from "bun:test";
import { Footer, validateEmail } from "@/components/site/footer";

describe("Footer smoke import", () => {
  it("Footer component is exported as a function", () => {
    expect(typeof Footer).toBe("function");
  });

  it("validateEmail is exported as a function", () => {
    expect(typeof validateEmail).toBe("function");
  });
});

describe("validateEmail", () => {
  it("accepts a standard email", () => {
    expect(validateEmail("test@np.com")).toBe("test@np.com");
  });

  it("trims whitespace and lowercases", () => {
    expect(validateEmail("  Hello@Foo.COM  ")).toBe("hello@foo.com");
  });

  it("rejects strings without @", () => {
    expect(validateEmail("not-an-email")).toBeNull();
  });

  it("rejects empty strings", () => {
    expect(validateEmail("")).toBeNull();
    expect(validateEmail("   ")).toBeNull();
  });

  it("rejects emails missing TLD or local part", () => {
    expect(validateEmail("foo@")).toBeNull();
    expect(validateEmail("@bar.com")).toBeNull();
  });

  it("rejects emails over 255 chars", () => {
    const long = "a".repeat(250) + "@b.com"; // 256 total
    expect(validateEmail(long)).toBeNull();
  });
});
