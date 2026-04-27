/**
 * Navbar — smoke import + variant detection logic (no DOM rendering; bun:test env has no jsdom)
 *
 * Covers:
 *  - module imports cleanly (no syntax / SSR errors)
 *  - isHome detection logic (pathname === base or `${base}/`)
 *  - variant derivation (transparent on home, default elsewhere)
 *  - scroll threshold logic (>100px → scrolled)
 */
import { describe, expect, it } from "bun:test";
import { Navbar } from "@/components/site/navbar";

// Pure helpers replicating the component's internal logic so we can exercise
// it without rendering (we have no jsdom + no @testing-library/react).
function isHomePath(pathname: string, locale: string): boolean {
  const base = `/${locale}`;
  return pathname === base || pathname === `${base}/`;
}

function deriveVariant(pathname: string, locale: string): "transparent" | "default" {
  return isHomePath(pathname, locale) ? "transparent" : "default";
}

function isScrolled(scrollY: number): boolean {
  return scrollY > 100;
}

describe("Navbar smoke import", () => {
  it("Navbar component is exported as a function", () => {
    expect(typeof Navbar).toBe("function");
  });
});

describe("isHome detection", () => {
  it("matches /es exactly", () => {
    expect(isHomePath("/es", "es")).toBe(true);
  });

  it("matches /es/ with trailing slash", () => {
    expect(isHomePath("/es/", "es")).toBe(true);
  });

  it("does NOT match /es/cuenta", () => {
    expect(isHomePath("/es/cuenta", "es")).toBe(false);
  });

  it("does NOT match /es/tienda", () => {
    expect(isHomePath("/es/tienda", "es")).toBe(false);
  });

  it("works with other locales", () => {
    expect(isHomePath("/pt", "pt")).toBe(true);
    expect(isHomePath("/pt/cuenta", "pt")).toBe(false);
  });
});

describe("variant derivation", () => {
  it("transparent on home", () => {
    expect(deriveVariant("/es", "es")).toBe("transparent");
  });

  it("default on subpages", () => {
    expect(deriveVariant("/es/cuenta", "es")).toBe("default");
    expect(deriveVariant("/es/tienda", "es")).toBe("default");
  });
});

describe("scroll threshold", () => {
  it("not scrolled at 0", () => {
    expect(isScrolled(0)).toBe(false);
  });

  it("not scrolled at 100 (boundary)", () => {
    expect(isScrolled(100)).toBe(false);
  });

  it("scrolled at 101", () => {
    expect(isScrolled(101)).toBe(true);
  });

  it("scrolled at 500", () => {
    expect(isScrolled(500)).toBe(true);
  });
});
