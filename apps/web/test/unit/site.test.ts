import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getSiteUrl } from "@/lib/site";

const KEY = "NEXT_PUBLIC_SITE_URL";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY];
});
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("getSiteUrl", () => {
  it("returns fallback when env is unset", () => {
    delete process.env[KEY];
    expect(getSiteUrl()).toBe("https://novapatch.com");
  });

  it("returns env value when set", () => {
    process.env[KEY] = "https://staging.novapatch.com";
    expect(getSiteUrl()).toBe("https://staging.novapatch.com");
  });

  it("strips trailing slash", () => {
    process.env[KEY] = "https://staging.novapatch.com/";
    expect(getSiteUrl()).toBe("https://staging.novapatch.com");
  });
});
