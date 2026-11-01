import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";

const greenPark = { name: "Green Park Residency", addressText: "Plot 12, Sector 45, Gurugram" };

/** An admin (in no society), Green Park with a manager and two residents, and an empty Lake View. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const admin = await addUser(store, { role: "ADMIN" });
  const gp = addSociety(store, greenPark);
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const manager = await addUser(store, { role: "MANAGER", societyId: gp.id });
  await addUser(store, { societyId: gp.id });
  await addUser(store, { societyId: gp.id, status: "INVITED" });
  return { ...ctx, gp, lakeView, asAdmin: sessionCookie(store, admin.id, clock.now), asManager: sessionCookie(store, manager.id, clock.now) };
}

describe("POST /api/societies", () => {
  it("lets an admin create any number of societies without joining them", async () => {
    const { app, store, clock } = createTestApp();
    const admin = await addUser(store, { role: "ADMIN" });
    const cookie = sessionCookie(store, admin.id, clock.now);

    const first = await request(app).post("/api/societies").set("Cookie", cookie).send({ ...greenPark, name: "  Green Park Residency " });
    const second = await request(app).post("/api/societies").set("Cookie", cookie).send({ ...greenPark, name: "Lake View Towers" });

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject(greenPark);
    expect(second.status).toBe(201);
    expect(store.societies.size).toBe(2);
    expect(admin.societyId).toBeNull();
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.data.society).toBeNull();
  });

  it("is admin-only: 401 without a session, 403 for managers", async () => {
    const { app, asManager } = await setup();
    expect((await request(app).post("/api/societies").send(greenPark)).status).toBe(401);
    const res = await request(app).post("/api/societies").set("Cookie", asManager).send(greenPark);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("validates name and address length", async () => {
    const { app, asAdmin } = await setup();
    const res = await request(app).post("/api/societies").set("Cookie", asAdmin).send({ name: "GP", addressText: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toEqual({
      name: ["Society name must be at least 3 characters"],
      addressText: ["Address must be at least 5 characters"],
    });
  });
});

describe("GET /api/societies", () => {
  it("lists every society, newest first, with manager and resident counts", async () => {
    const { app, asAdmin, asManager } = await setup();

    const res = await request(app).get("/api/societies").set("Cookie", asAdmin);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data.map((s: { name: string; managerCount: number; residentCount: number }) => [s.name, s.managerCount, s.residentCount])).toEqual([
      ["Lake View Towers", 0, 0],
      ["Green Park Residency", 1, 2],
    ]);
    expect((await request(app).get("/api/societies").set("Cookie", asManager)).status).toBe(403);
  });
});

describe("GET and PATCH /api/societies/:id", () => {
  it("reads and updates the chosen society only", async () => {
    const { app, store, asAdmin, gp, lakeView } = await setup();

    expect((await request(app).get(`/api/societies/${gp.id}`).set("Cookie", asAdmin)).body.data).toMatchObject({ id: gp.id, ...greenPark });
    const res = await request(app).patch(`/api/societies/${gp.id}`).set("Cookie", asAdmin).send({ name: "Green Park Residency Phase 2" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: gp.id, name: "Green Park Residency Phase 2", addressText: greenPark.addressText });
    expect(store.societies.get(lakeView.id)?.name).toBe("Lake View Towers");
  });

  it("returns 404 for an unknown society, 400 for a bad id or empty patch, 403 for managers", async () => {
    const { app, asAdmin, asManager, gp } = await setup();
    const unknown = "7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10";

    expect((await request(app).get(`/api/societies/${unknown}`).set("Cookie", asAdmin)).status).toBe(404);
    expect((await request(app).patch(`/api/societies/${unknown}`).set("Cookie", asAdmin).send({ name: "Whatever Name" })).status).toBe(404);
    expect((await request(app).get("/api/societies/nope").set("Cookie", asAdmin)).status).toBe(400);
    expect((await request(app).patch(`/api/societies/${gp.id}`).set("Cookie", asAdmin).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/societies/${gp.id}`).set("Cookie", asManager).send({ name: "Mine Now" })).status).toBe(403);
  });
});
