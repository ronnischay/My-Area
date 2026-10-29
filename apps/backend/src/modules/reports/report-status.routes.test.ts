import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addReport, addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";
import { GPS_MARKER, makeJpeg } from "../../../test/helpers/images.js";

/** Green Park: admin, manager, two residents and an OPEN report by Meera. Lake View: a manager. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", societyId: greenPark.id, name: "Asha Rao" });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma" });
  const meera = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer" });
  const farhan = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Farhan Qureshi" });
  const otherManager = await addUser(store, { role: "MANAGER", societyId: lakeView.id });
  const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
  const cookie = (userId: string) => sessionCookie(store, userId, clock.now);
  return {
    ...ctx,
    greenPark,
    manager,
    report,
    asAdmin: cookie(admin.id),
    asManager: cookie(manager.id),
    asMeera: cookie(meera.id),
    asFarhan: cookie(farhan.id),
    asOtherManager: cookie(otherManager.id),
  };
}

const patchStatus = (app: Parameters<typeof request>[0], cookie: string, id: string, body: object) =>
  request(app).patch(`/api/reports/${id}/status`).set("Cookie", cookie).send(body);

describe("PATCH /api/reports/:id/status", () => {
  it("lets a manager move a report forward, recording who, when and the note", async () => {
    const { app, store, clock, asManager, manager, report } = await setup();

    const res = await patchStatus(app, asManager, report.id, { status: "IN_PROGRESS", note: "  Electrician booked for Friday  " });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toMatchObject({ status: "IN_PROGRESS", resolvedAt: null });
    expect(res.body.data.statusHistory).toEqual([
      {
        id: expect.any(String),
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        note: "Electrician booked for Friday",
        changedBy: { id: manager.id, name: "Rohit Sharma" },
        createdAt: clock.now.toISOString(),
      },
    ]);
    expect(store.reports.get(report.id)?.status).toBe("IN_PROGRESS");
  });

  it("sets resolvedAt when resolved, stores a blank note as none, and admins may do it too", async () => {
    const { app, clock, asManager, asAdmin, report } = await setup();
    await patchStatus(app, asManager, report.id, { status: "IN_PROGRESS" });
    clock.advance(60 * 60 * 1000);

    const res = await patchStatus(app, asAdmin, report.id, { status: "RESOLVED", note: "   " });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "RESOLVED", resolvedAt: clock.now.toISOString() });
    expect(res.body.data.statusHistory.map((h: { toStatus: string; note: string | null }) => [h.toStatus, h.note])).toEqual([
      ["IN_PROGRESS", null],
      ["RESOLVED", null],
    ]);
  });

  it("refuses transitions that aren't allowed with 409, leaving the report unchanged", async () => {
    const { app, store, asManager, report } = await setup();

    const skip = await patchStatus(app, asManager, report.id, { status: "RESOLVED" });
    expect(skip.status).toBe(409);
    expect(skip.body.error).toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      message: "A report that is open can't be changed to resolved.",
      details: { from: "OPEN", to: "RESOLVED" },
    });

    await patchStatus(app, asManager, report.id, { status: "REJECTED" });
    const reopen = await patchStatus(app, asManager, report.id, { status: "OPEN" });
    expect(reopen.status).toBe(409);
    expect(store.reports.get(report.id)?.status).toBe("REJECTED");
    expect(store.statusHistory).toHaveLength(1);
  });

  it("is for managers and admins only", async () => {
    const { app, store, asMeera, report } = await setup();
    expect((await request(app).patch(`/api/reports/${report.id}/status`).send({ status: "IN_PROGRESS" })).status).toBe(401);

    const res = await patchStatus(app, asMeera, report.id, { status: "IN_PROGRESS" });
    expect(res.status).toBe(403);
    expect(store.reports.get(report.id)?.status).toBe("OPEN");
  });

  it("treats another society's report like an unknown one", async () => {
    const { app, store, asOtherManager, asManager, report } = await setup();
    const foreign = await patchStatus(app, asOtherManager, report.id, { status: "IN_PROGRESS" });
    const unknown = await patchStatus(app, asManager, "7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10", { status: "IN_PROGRESS" });

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error.message).toBe(unknown.body.error.message);
    expect(store.reports.get(report.id)?.status).toBe("OPEN");
  });

  it("validates the body and the id", async () => {
    const { app, asManager, report } = await setup();
    const bad = await patchStatus(app, asManager, report.id, { status: "CLOSED", note: "x".repeat(1001) });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details.fieldErrors).sort()).toEqual(["note", "status"]);
    expect((await patchStatus(app, asManager, "nope", { status: "IN_PROGRESS" })).status).toBe(400);
  });

  it("refuses a cross-site request", async () => {
    const { app, asManager, report } = await setup();
    const res = await request(app)
      .patch(`/api/reports/${report.id}/status`)
      .set("Cookie", asManager)
      .set("Origin", "https://evil.example")
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(403);
  });

  it("shows the timeline to residents too", async () => {
    const { app, asManager, asFarhan, report } = await setup();
    await patchStatus(app, asManager, report.id, { status: "IN_PROGRESS", note: "On it" });
    const res = await request(app).get(`/api/reports/${report.id}`).set("Cookie", asFarhan);
    expect(res.body.data.statusHistory).toEqual([expect.objectContaining({ toStatus: "IN_PROGRESS", note: "On it", changedBy: expect.objectContaining({ name: "Rohit Sharma" }) })]);
  });
});

describe("POST /api/reports/:id/media (resolution photo)", () => {
  const upload = (app: Parameters<typeof request>[0], cookie: string, id: string) =>
    request(app).post(`/api/reports/${id}/media`).set("Cookie", cookie).attach("photo", makeJpeg({ orientation: 6 }), { filename: "fixed.jpg", contentType: "image/jpeg" });

  it("adds a RESOLUTION photo, stripped of metadata, that appears on the report", async () => {
    const { app, mediaStorage, asManager, asMeera, report } = await setup();

    const res = await upload(app, asManager, report.id);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ purpose: "RESOLUTION", mediaType: "IMAGE", url: `/api/media/${res.body.data.id}`, width: 900, height: 1200 });
    const stored = mediaStorage.files.get(`reports/${res.body.data.id}.jpg`);
    expect(stored?.includes(Buffer.from(GPS_MARKER))).toBe(false);

    const detail = await request(app).get(`/api/reports/${report.id}`).set("Cookie", asMeera);
    expect(detail.body.data.media.map((m: { purpose: string }) => m.purpose)).toEqual(["RESOLUTION"]);
  });

  it("is for managers and admins only, and never writes a file for a missing report", async () => {
    const { app, mediaStorage, asMeera, asOtherManager, report } = await setup();
    expect((await upload(app, asMeera, report.id)).status).toBe(403);
    expect((await upload(app, asOtherManager, report.id)).status).toBe(404);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("deletes the stored file when the database write fails", async () => {
    const { app, store, mediaStorage, asManager, report } = await setup();
    store.failReportWrites = new Error("db down");
    expect((await upload(app, asManager, report.id)).status).toBe(500);
    expect(mediaStorage.files.size).toBe(0);
    expect(mediaStorage.deleted).toHaveLength(1);
  });

  it("requires a photo", async () => {
    const { app, asManager, report } = await setup();
    const res = await request(app).post(`/api/reports/${report.id}/media`).set("Cookie", asManager).field("x", "y");
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.photo).toEqual(["Add a photo"]);
  });
});

describe("GET /api/management/stats", () => {
  it("counts the caller's society only, including zeros", async () => {
    const { app, store, greenPark, asManager, asOtherManager, report } = await setup();
    addReport(store, { societyId: greenPark.id, createdById: report.createdById, status: "RESOLVED", resolvedAt: new Date() });

    const res = await request(app).get("/api/management/stats").set("Cookie", asManager);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { byStatus: { OPEN: 1, IN_PROGRESS: 0, RESOLVED: 1, REJECTED: 0 } } });

    const other = await request(app).get("/api/management/stats").set("Cookie", asOtherManager);
    expect(other.body.data.byStatus).toEqual({ OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 });
  });

  it("is for managers and admins only", async () => {
    const { app, asMeera } = await setup();
    expect((await request(app).get("/api/management/stats")).status).toBe(401);
    expect((await request(app).get("/api/management/stats").set("Cookie", asMeera)).status).toBe(403);
  });
});
