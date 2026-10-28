import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../test/helpers/app.js";

describe("app", () => {
  it("GET /health returns ok with a request id", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sets security headers via helmet and hides x-powered-by", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns the error envelope with a matching request id for unknown routes", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found", requestId: res.headers["x-request-id"] },
    });
  });

  it("keeps a safe caller-provided request id and replaces an unsafe one", async () => {
    const { app } = createTestApp();

    const safe = await request(app).get("/health").set("X-Request-Id", "client-req-12345");
    expect(safe.headers["x-request-id"]).toBe("client-req-12345");

    const unsafe = await request(app).get("/health").set("X-Request-Id", "<script>alert(1)</script>");
    expect(unsafe.headers["x-request-id"]).not.toContain("<");
    expect(unsafe.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects malformed JSON with 400 VALIDATION_ERROR", async () => {
    const { app } = createTestApp();

    const res = await request(app).post("/anything").set("Content-Type", "application/json").send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", message: "Request body is not valid JSON" });
  });

  it("rejects JSON bodies over 100kb with 413 PAYLOAD_TOO_LARGE", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/anything")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ text: "x".repeat(110 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("allows CORS only for configured frontend origins", async () => {
    const { app } = createTestApp({ frontendOrigins: ["http://localhost:3000"] });

    const allowed = await request(app).get("/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-expose-headers"]).toContain("X-Request-Id");

    const blocked = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
