import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

type HealthBody = { status: string };
type ErrorBody = { error: { code: string; message: string } };

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body).toEqual({ status: "ok" });
  });

  it("sets JSON content-type", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

describe("default 404", () => {
  it("returns 404 with the canonical error envelope for unknown paths", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toMatch(/not found/i);
  });
});
