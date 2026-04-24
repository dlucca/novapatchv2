import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("sets JSON content-type", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

describe("default 404", () => {
  it("returns 404 for unknown paths", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    expect(res.status).toBe(404);
  });
});
