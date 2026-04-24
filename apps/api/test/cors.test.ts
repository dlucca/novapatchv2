import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("CORS", () => {
  it("allows localhost:3000 (storefront) with credentials on GET", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("responds 204 to preflight OPTIONS from allowed origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }),
    );
    // Hono's cors helper returns 204 on preflight
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/GET/);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/authorization/i);
  });

  it("does NOT reflect a disallowed origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        headers: { Origin: "https://evil.example.com" },
      }),
    );
    // Request still succeeds, but the browser will enforce: ACAO must NOT equal the evil origin.
    expect(res.headers.get("access-control-allow-origin")).not.toBe("https://evil.example.com");
  });
});
