import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addReport, addReportMedia, addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";

/** Two societies. Green Park has an admin, a manager and two residents; Lake View has one resident. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", societyId: greenPark.id, name: "Asha Rao" });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma" });
  const meera = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer" });
  const farhan = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Farhan Qureshi" });
  const neha = await addUser(store, { role: "RESIDENT", societyId: lakeView.id, name: "Neha Kapoor" });
  const cookie = (userId: string) => sessionCookie(store, userId, clock.now);
  return {
    ...ctx,
    greenPark,
    lakeView,
    admin,
    manager,
    meera,
    farhan,
    neha,
    asAdmin: cookie(admin.id),
    asManager: cookie(manager.id),
    asMeera: cookie(meera.id),
    asFarhan: cookie(farhan.id),
    asNeha: cookie(neha.id),
  };
}

const pothole = {
  title: "  Pothole outside Gate 2  ",
  description: "A deep pothole has opened up right outside Gate 2. Two-wheelers are swerving around it.",
  category: "ROADS",
  locationText: "Gate 2, service road",
};

describe("access to /api/reports", () => {
  it("needs a session and a society", async () => {
    const { app, store, clock } = await setup();
    const newAdmin = await addUser(store, { role: "ADMIN" });

    expect((await request(app).get("/api/reports")).status).toBe(401);
    expect((await request(app).post("/api/reports").send(pothole)).status).toBe(401);

    const noSociety = await request(app).get("/api/reports").set("Cookie", sessionCookie(store, newAdmin.id, clock.now));
    expect(noSociety.status).toBe(403);
    expect(noSociety.body.error.code).toBe("SOCIETY_REQUIRED");
  });

  it("is open to residents, managers and admins of the society", async () => {
    const { app, asAdmin, asManager, asMeera } = await setup();
    for (const cookie of [asAdmin, asManager, asMeera]) {
      expect((await request(app).get("/api/reports").set("Cookie", cookie)).status).toBe(200);
    }
  });
});

describe("POST /api/reports", () => {
  it("creates an OPEN report in the caller's society, ignoring society and author in the body", async () => {
    const { app, store, asMeera, meera, greenPark, lakeView, neha } = await setup();

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", asMeera)
      .send({ ...pothole, societyId: lakeView.id, createdById: neha.id, status: "RESOLVED" });

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toMatchObject({
      title: "Pothole outside Gate 2",
      category: "ROADS",
      locationText: "Gate 2, service road",
      status: "OPEN",
      media: [],
      isMine: true,
      createdBy: { id: meera.id, name: "Meera Iyer" },
      resolvedAt: null,
      statusHistory: [],
    });
    expect(res.body.data).not.toHaveProperty("societyId");

    const saved = store.reports.get(res.body.data.id);
    expect(saved).toMatchObject({ societyId: greenPark.id, createdById: meera.id, status: "OPEN" });
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const { app, store, asMeera } = await setup();

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", asMeera)
      .send({ title: "Hole", description: "   short   ", category: "POTHOLES" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["category", "description", "locationText", "title"]);
    expect(store.reports.size).toBe(0);
  });

  it("rejects text over the limits", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", asMeera)
      .send({ ...pothole, title: "x".repeat(121), description: "y".repeat(2001), locationText: "z".repeat(256) });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["description", "locationText", "title"]);
  });

  it("returns a generic 500 when the database write fails", async () => {
    const { app, store, logger, asMeera } = await setup();
    store.failReportWrites = new Error('connection to "db.internal:5432" refused, password=hunter2');

    const res = await request(app).post("/api/reports").set("Cookie", asMeera).send(pothole);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again later." });
    expect(JSON.stringify(res.body)).not.toMatch(/db\.internal|hunter2/);
    expect(logger.error).toHaveBeenCalled();
    expect(store.reports.size).toBe(0);
  });

  it("refuses a cross-site request", async () => {
    const { app, store, asMeera } = await setup();
    const res = await request(app).post("/api/reports").set("Cookie", asMeera).set("Origin", "https://evil.example").send(pothole);
    expect(res.status).toBe(403);
    expect(store.reports.size).toBe(0);
  });
});

describe("GET /api/reports", () => {
  it("lists only the caller's society, newest first, with pagination meta", async () => {
    const { app, store, greenPark, lakeView, meera, neha, asMeera } = await setup();
    const first = addReport(store, { societyId: greenPark.id, createdById: meera.id, title: "Overflowing bins at Block A" });
    const second = addReport(store, { societyId: greenPark.id, createdById: meera.id, title: "Broken swing in the park" });
    const third = addReport(store, { societyId: greenPark.id, createdById: meera.id, title: "Water leak in basement" });
    addReport(store, { societyId: lakeView.id, createdById: neha.id, title: "Lake View lift stuck" });

    const res = await request(app).get("/api/reports?pageSize=2").set("Cookie", asMeera);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([third.id, second.id]);
    expect(res.body.data[0]).toEqual({
      id: third.id,
      title: "Water leak in basement",
      category: "STREETLIGHTS",
      locationText: "Block C main gate",
      status: "OPEN",
      thumbnailUrl: null,
      isMine: true,
      createdAt: third.createdAt.toISOString(),
    });

    const page2 = await request(app).get("/api/reports?pageSize=2&page=2").set("Cookie", asMeera);
    expect(page2.body.data.map((r: { id: string }) => r.id)).toEqual([first.id]);

    const oldest = await request(app).get("/api/reports?sort=oldest").set("Cookie", asMeera);
    expect(oldest.body.data.map((r: { id: string }) => r.id)).toEqual([first.id, second.id, third.id]);
  });

  it("filters by status, category, mine and search", async () => {
    const { app, store, greenPark, meera, farhan, asMeera } = await setup();
    const bins = addReport(store, { societyId: greenPark.id, createdById: meera.id, title: "Overflowing bins", category: "WASTE" });
    const light = addReport(store, {
      societyId: greenPark.id,
      createdById: farhan.id,
      title: "Light flickering",
      locationText: "Clubhouse 50% corridor",
      status: "RESOLVED",
      resolvedAt: new Date("2026-10-20T09:00:00.000Z"),
    });

    const ids = async (query: string) =>
      (await request(app).get(`/api/reports?${query}`).set("Cookie", asMeera)).body.data.map((r: { id: string }) => r.id);

    expect(await ids("status=RESOLVED")).toEqual([light.id]);
    expect(await ids("category=WASTE")).toEqual([bins.id]);
    expect(await ids("mine=true")).toEqual([bins.id]);
    expect(await ids("mine=false")).toEqual([light.id, bins.id]);
    expect(await ids("q=CLUBHOUSE")).toEqual([light.id]);
    expect(await ids("q=bins")).toEqual([bins.id]);
    expect(await ids("q=%20%20")).toEqual([light.id, bins.id]);
    expect(await ids("q=nothing-like-this")).toEqual([]);
  });

  it("marks other people's reports as not mine and shows the first submission photo", async () => {
    const { app, store, greenPark, farhan, asMeera } = await setup();
    const report = addReport(store, { societyId: greenPark.id, createdById: farhan.id });
    const photo = addReportMedia(store, { reportId: report.id });
    addReportMedia(store, { reportId: report.id, purpose: "RESOLUTION" });

    const res = await request(app).get("/api/reports").set("Cookie", asMeera);

    expect(res.body.data[0]).toMatchObject({ isMine: false, thumbnailUrl: photo.url });
  });

  it("returns an empty page, not an error, when nothing matches", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app).get("/api/reports").set("Cookie", asMeera);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it("rejects invalid query values", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app)
      .get(`/api/reports?status=CLOSED&category=TRAFFIC&mine=yes&sort=popular&pageSize=51&page=0&q=${"a".repeat(101)}`)
      .set("Cookie", asMeera);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
      "category",
      "mine",
      "page",
      "pageSize",
      "q",
      "sort",
      "status",
    ]);
  });
});

describe("GET /api/reports/:id", () => {
  it("returns the report with its media and an empty status history", async () => {
    const { app, store, greenPark, meera, asMeera } = await setup();
    const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
    const photo = addReportMedia(store, { reportId: report.id });

    const res = await request(app).get(`/api/reports/${report.id}`).set("Cookie", asMeera);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toEqual({
      id: report.id,
      title: report.title,
      description: report.description,
      category: "STREETLIGHTS",
      locationText: "Block C main gate",
      status: "OPEN",
      media: [
        {
          id: photo.id,
          purpose: "SUBMISSION",
          mediaType: "IMAGE",
          url: photo.url,
          mimeType: "image/jpeg",
          sizeBytes: 245_000,
          width: 1200,
          height: 900,
          createdAt: photo.createdAt.toISOString(),
        },
      ],
      isMine: true,
      createdBy: { id: meera.id, name: "Meera Iyer" },
      resolvedAt: null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      statusHistory: [],
    });
  });

  it("shows the reporter's name to managers, admins and the author, but not to other residents", async () => {
    const { app, store, greenPark, meera, asMeera, asFarhan, asManager, asAdmin } = await setup();
    const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
    const createdBy = async (cookie: string) =>
      (await request(app).get(`/api/reports/${report.id}`).set("Cookie", cookie)).body.data.createdBy;

    expect(await createdBy(asMeera)).toEqual({ id: meera.id, name: "Meera Iyer" });
    expect(await createdBy(asManager)).toEqual({ id: meera.id, name: "Meera Iyer" });
    expect(await createdBy(asAdmin)).toEqual({ id: meera.id, name: "Meera Iyer" });
    expect(await createdBy(asFarhan)).toBeNull();
  });

  it("treats another society's report exactly like an unknown id", async () => {
    const { app, store, greenPark, meera, asNeha, asMeera } = await setup();
    const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });

    const foreign = await request(app).get(`/api/reports/${report.id}`).set("Cookie", asNeha);
    const unknown = await request(app).get("/api/reports/7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10").set("Cookie", asMeera);

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error.code).toBe("NOT_FOUND");
    expect(foreign.body.error.message).toBe(unknown.body.error.message);

    const list = await request(app).get("/api/reports").set("Cookie", asNeha);
    expect(list.body.data).toEqual([]);
  });

  it("rejects an id that isn't a UUID", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app).get("/api/reports/not-a-uuid").set("Cookie", asMeera);
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toHaveProperty("id");
  });
});
