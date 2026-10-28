import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createFakeLogger } from "../../test/helpers/app.js";
import type { AuthContext } from "../modules/auth/auth.types.js";
import { errorHandler } from "./error-handler.js";
import { getAuth, requireAuth } from "./require-auth.js";
import { requireRole } from "./require-role.js";
import { requireSameOrigin } from "./require-same-origin.js";
import { requireSociety } from "./require-society.js";
import { requestId } from "./request-id.js";

const sessions: Record<string, AuthContext> = {
  "resident-token": { userId: "u-resident", role: "RESIDENT", societyId: "s-1" },
  "manager-token": { userId: "u-manager", role: "MANAGER", societyId: "s-1" },
  "new-admin-token": { userId: "u-admin", role: "ADMIN", societyId: null },
};

function buildApp() {
  const app = express();
  app.use(requestId());
  app.use(requireSameOrigin(["http://localhost:3000"]));
  const authenticated = requireAuth(async (token) => sessions[token] ?? null);
  app.get("/me", authenticated, (req, res) => {
    res.json(getAuth(req));
  });
  app.post("/managers-only", authenticated, requireRole("MANAGER", "ADMIN"), (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/society-only", authenticated, requireSociety, (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/open", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler(createFakeLogger()));
  return app;
}

const cookie = (token: string) => `myarea_session=${token}`;

describe("requireAuth", () => {
  it("attaches the session's auth context", async () => {
    const res = await request(buildApp()).get("/me").set("Cookie", cookie("resident-token"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(sessions["resident-token"]);
  });

  it("returns 401 UNAUTHENTICATED without a cookie or with an unknown token", async () => {
    const missing = await request(buildApp()).get("/me");
    const unknown = await request(buildApp()).get("/me").set("Cookie", cookie("nope"));

    expect(missing.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("requireRole", () => {
  it("returns 403 FORBIDDEN for a role that isn't allowed", async () => {
    const resident = await request(buildApp()).post("/managers-only").set("Cookie", cookie("resident-token"));
    const manager = await request(buildApp()).post("/managers-only").set("Cookie", cookie("manager-token"));

    expect(resident.status).toBe(403);
    expect(resident.body.error.code).toBe("FORBIDDEN");
    expect(manager.status).toBe(200);
  });
});

describe("requireSociety", () => {
  it("returns 403 SOCIETY_REQUIRED for an admin without a society", async () => {
    const res = await request(buildApp()).get("/society-only").set("Cookie", cookie("new-admin-token"));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SOCIETY_REQUIRED");
  });
});

describe("requireSameOrigin", () => {
  it("rejects state-changing requests from other origins, allows ours and origin-less callers", async () => {
    const evil = await request(buildApp()).post("/open").set("Origin", "https://evil.example");
    const ours = await request(buildApp()).post("/open").set("Origin", "http://localhost:3000");
    const noOrigin = await request(buildApp()).post("/open");
    const safeMethod = await request(buildApp()).get("/me").set("Origin", "https://evil.example").set("Cookie", cookie("resident-token"));

    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe("FORBIDDEN");
    expect(ours.status).toBe(200);
    expect(noOrigin.status).toBe(200);
    expect(safeMethod.status).toBe(200);
  });
});
