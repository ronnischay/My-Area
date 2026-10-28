import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";

const greenPark = { name: "Green Park Residency", addressText: "Plot 12, Sector 45, Gurugram" };

describe("POST /api/societies", () => {
  it("lets an admin without a society create one and links them to it", async () => {
    const { app, store, clock } = createTestApp();
    const admin = await addUser(store, { role: "ADMIN" });

    const res = await request(app).post("/api/societies").set("Cookie", sessionCookie(store, admin.id, clock.now)).send({
      name: "  Green Park Residency ",
      addressText: greenPark.addressText,
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject(greenPark);
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(admin.societyId).toBe(res.body.data.id);

    const me = await request(app).get("/api/auth/me").set("Cookie", sessionCookie(store, admin.id, clock.now));
    expect(me.body.data.society).toMatchObject(greenPark);
  });

  it("refuses a second society with 409 SOCIETY_ALREADY_EXISTS", async () => {
    const { app, store, clock } = createTestApp();
    const admin = await addUser(store, { role: "ADMIN" });
    const cookie = sessionCookie(store, admin.id, clock.now);

    await request(app).post("/api/societies").set("Cookie", cookie).send(greenPark);
    const second = await request(app).post("/api/societies").set("Cookie", cookie).send({ ...greenPark, name: "Another Society" });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("SOCIETY_ALREADY_EXISTS");
    expect(store.societies.size).toBe(1);
  });

  it("is admin-only: 401 without a session, 403 for managers and residents", async () => {
    const { app, store, clock } = createTestApp();
    const society = addSociety(store);
    const manager = await addUser(store, { role: "MANAGER", societyId: society.id });

    const anonymous = await request(app).post("/api/societies").send(greenPark);
    const asManager = await request(app).post("/api/societies").set("Cookie", sessionCookie(store, manager.id, clock.now)).send(greenPark);

    expect(anonymous.status).toBe(401);
    expect(asManager.status).toBe(403);
    expect(asManager.body.error.code).toBe("FORBIDDEN");
  });

  it("validates name and address length", async () => {
    const { app, store, clock } = createTestApp();
    const admin = await addUser(store, { role: "ADMIN" });

    const res = await request(app).post("/api/societies").set("Cookie", sessionCookie(store, admin.id, clock.now)).send({ name: "GP", addressText: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toEqual({
      name: ["Society name must be at least 3 characters"],
      addressText: ["Address must be at least 5 characters"],
    });
  });
});

describe("PATCH /api/societies/current", () => {
  it("updates only the admin's own society", async () => {
    const { app, store, clock } = createTestApp();
    const own = addSociety(store);
    const other = addSociety(store, { name: "Lake View Towers" });
    const admin = await addUser(store, { role: "ADMIN", societyId: own.id });

    const res = await request(app)
      .patch("/api/societies/current")
      .set("Cookie", sessionCookie(store, admin.id, clock.now))
      .send({ name: "Green Park Residency Phase 2" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: own.id, name: "Green Park Residency Phase 2", addressText: own.addressText });
    expect(other.name).toBe("Lake View Towers");
  });

  it("needs a society first (403 SOCIETY_REQUIRED) and at least one field (400)", async () => {
    const { app, store, clock } = createTestApp();
    const newAdmin = await addUser(store, { role: "ADMIN" });
    const society = addSociety(store);
    const admin = await addUser(store, { role: "ADMIN", societyId: society.id });

    const noSociety = await request(app).patch("/api/societies/current").set("Cookie", sessionCookie(store, newAdmin.id, clock.now)).send({ name: "Whatever Name" });
    const empty = await request(app).patch("/api/societies/current").set("Cookie", sessionCookie(store, admin.id, clock.now)).send({});

    expect(noSociety.status).toBe(403);
    expect(noSociety.body.error.code).toBe("SOCIETY_REQUIRED");
    expect(empty.status).toBe(400);
    expect(empty.body.error.details.formErrors).toEqual(["Change the name or the address"]);
  });
});
