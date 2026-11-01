import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addReport, addReportMedia, addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";
import { GPS_MARKER, makeJpeg, makePng, makeTruncatedJpeg, makeWebp } from "../../../test/helpers/images.js";
import { MAX_PHOTO_BYTES } from "../media/media.constants.js";

/** Two societies. Green Park has a manager and two residents; Lake View has one resident. Plus an admin, in neither. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", name: "Asha Rao" });
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

/** A multipart POST /api/reports with the given text fields and (optionally) a photo. */
function postReport(
  app: Parameters<typeof request>[0],
  cookie: string,
  fields: Record<string, string> = pothole,
  photo: { bytes: Buffer; filename?: string; contentType?: string } | null = { bytes: makeJpeg({ orientation: 6 }) },
) {
  const req = request(app).post("/api/reports").set("Cookie", cookie);
  for (const [name, value] of Object.entries(fields)) req.field(name, value);
  if (photo) req.attach("photo", photo.bytes, { filename: photo.filename ?? "IMG_2041.jpg", contentType: photo.contentType ?? "image/jpeg" });
  return req;
}

describe("access to /api/reports", () => {
  it("needs a session and a society, so admins (who belong to none) are refused", async () => {
    const { app, asAdmin } = await setup();

    expect((await request(app).get("/api/reports")).status).toBe(401);
    expect((await request(app).post("/api/reports").send(pothole)).status).toBe(401);

    const admin = await request(app).get("/api/reports").set("Cookie", asAdmin);
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("SOCIETY_REQUIRED");
  });

  it("is open to residents and managers of the society", async () => {
    const { app, asManager, asMeera } = await setup();
    for (const cookie of [asManager, asMeera]) {
      expect((await request(app).get("/api/reports").set("Cookie", cookie)).status).toBe(200);
    }
  });
});

describe("POST /api/reports", () => {
  it("creates an OPEN report with its photo in the caller's society, ignoring society and author in the body", async () => {
    const { app, store, mediaStorage, asMeera, meera, greenPark, lakeView, neha } = await setup();

    const res = await postReport(app, asMeera, { ...pothole, societyId: lakeView.id, createdById: neha.id, status: "RESOLVED" });

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    const photoId = res.body.data.media[0]?.id;
    expect(res.body.data).toMatchObject({
      title: "Pothole outside Gate 2",
      category: "ROADS",
      locationText: "Gate 2, service road",
      status: "OPEN",
      isMine: true,
      createdBy: { id: meera.id, name: "Meera Iyer" },
      resolvedAt: null,
      statusHistory: [],
    });
    expect(res.body.data.media).toEqual([
      {
        id: photoId,
        purpose: "SUBMISSION",
        mediaType: "IMAGE",
        url: `/api/media/${photoId}`,
        mimeType: "image/jpeg",
        createdAt: expect.any(String),
      },
    ]);
    expect(res.body.data).not.toHaveProperty("societyId");

    const saved = store.reports.get(res.body.data.id);
    expect(saved).toMatchObject({ societyId: greenPark.id, createdById: meera.id, status: "OPEN" });

    // The stored file is the cleaned photo: no GPS.
    const stored = mediaStorage.files.get(`reports/${photoId}.jpg`);
    expect(stored).toBeDefined();
    expect(stored!.includes(Buffer.from(GPS_MARKER))).toBe(false);
  });

  it("accepts PNG and WebP photos and stores them as JPEG", async () => {
    const { app, asMeera, mediaStorage } = await setup();
    const png = await postReport(app, asMeera, pothole, { bytes: makePng(), filename: "map.png", contentType: "image/png" });
    const webp = await postReport(app, asMeera, pothole, { bytes: makeWebp(), filename: "gate.webp", contentType: "image/webp" });

    expect(png.status).toBe(201);
    expect(webp.status).toBe(201);
    expect(png.body.data.media[0]).toMatchObject({ mimeType: "image/jpeg" });
    expect(webp.body.data.media[0]).toMatchObject({ mimeType: "image/jpeg" });
    expect([...mediaStorage.files.keys()].map((key) => key.split(".").pop())).toEqual(["jpg", "jpg"]);
  });


  it("returns field errors, including a missing photo, and saves nothing", async () => {
    const { app, store, mediaStorage, asMeera } = await setup();

    const res = await postReport(app, asMeera, { title: "Hole", description: "   short   ", category: "POTHOLES" }, null);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["category", "description", "locationText", "photo", "title"]);
    expect(res.body.error.details.fieldErrors.photo).toEqual(["Add a photo of the problem"]);
    expect(store.reports.size).toBe(0);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("doesn't store the photo when the text fields are invalid", async () => {
    const { app, store, mediaStorage, asMeera } = await setup();
    const res = await postReport(app, asMeera, { ...pothole, title: "x".repeat(121), description: "y".repeat(2001), locationText: "z".repeat(256) });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["description", "locationText", "title"]);
    expect(store.reports.size).toBe(0);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("requires multipart: a JSON body has no photo", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app).post("/api/reports").set("Cookie", asMeera).send(pothole);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(["photo"]);
  });

  it("rejects a photo over 5 MB with 413", async () => {
    const { app, store, asMeera } = await setup();
    const big = Buffer.concat([makeJpeg(), Buffer.alloc(MAX_PHOTO_BYTES)]);

    const res = await postReport(app, asMeera, pothole, { bytes: big });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatchObject({ code: "FILE_TOO_LARGE", details: { fieldErrors: { photo: ["The photo must be 5 MB or smaller."] } } });
    expect(store.reports.size).toBe(0);
  });

  it("rejects unsupported types and files whose content doesn't match their type with 415", async () => {
    const { app, store, mediaStorage, asMeera } = await setup();
    const cases = [
      { bytes: Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"), filename: "a.gif", contentType: "image/gif" },
      { bytes: makePng(), filename: "renamed.jpg", contentType: "image/jpeg" },
      { bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), filename: "x.jpg", contentType: "image/jpeg" },
      { bytes: Buffer.from("%PDF-1.7"), filename: "doc.pdf", contentType: "application/pdf" },
    ];

    for (const photo of cases) {
      const res = await postReport(app, asMeera, pothole, photo);
      expect(res.status, photo.filename).toBe(415);
      expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect(res.body.error.details.fieldErrors.photo).toEqual(["Use a JPEG, PNG or WebP photo."]);
    }
    expect(store.reports.size).toBe(0);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("rejects a damaged image with a field error", async () => {
    const { app, mediaStorage, asMeera } = await setup();
    const res = await postReport(app, asMeera, pothole, { bytes: makeTruncatedJpeg() });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.photo).toEqual(["This photo seems damaged. Try another one."]);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("accepts exactly one file in the photo field", async () => {
    const { app, asMeera } = await setup();
    const two = postReport(app, asMeera).attach("photo", makeJpeg(), { filename: "b.jpg", contentType: "image/jpeg" });
    const wrongField = request(app)
      .post("/api/reports")
      .set("Cookie", asMeera)
      .field(pothole)
      .attach("picture", makeJpeg(), { filename: "a.jpg", contentType: "image/jpeg" });

    for (const res of [await two, await wrongField]) {
      expect(res.status).toBe(400);
      expect(res.body.error.details.fieldErrors.photo).toEqual(["Attach one photo."]);
    }
  });

  it("returns 502 and saves nothing when the photo can't be stored", async () => {
    const { app, store, mediaStorage, logger, asMeera } = await setup();
    mediaStorage.failSaveWith = new Error("ENOSPC: no space left on device, open '/srv/uploads/reports/x.jpg'");

    const res = await postReport(app, asMeera);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({
      code: "MEDIA_UPLOAD_FAILED",
      message: "We couldn't save your photo, so nothing was submitted. Please try again.",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ENOSPC|srv/);
    expect(logger.error).toHaveBeenCalled();
    expect(store.reports.size).toBe(0);
  });

  it("returns a generic 500 and deletes the stored photo when the database write fails", async () => {
    const { app, store, mediaStorage, logger, asMeera } = await setup();
    store.failReportWrites = new Error('connection to "db.internal:5432" refused, password=hunter2');

    const res = await postReport(app, asMeera);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again later." });
    expect(JSON.stringify(res.body)).not.toMatch(/db\.internal|hunter2/);
    expect(logger.error).toHaveBeenCalled();
    expect(store.reports.size).toBe(0);
    expect(mediaStorage.deleted).toHaveLength(1);
    expect(mediaStorage.files.size).toBe(0);
  });

  it("still returns the database error when cleaning up the photo also fails", async () => {
    const { app, store, mediaStorage, logger, asMeera } = await setup();
    store.failReportWrites = new Error("db down");
    mediaStorage.failDeleteWith = new Error("EACCES");

    const res = await postReport(app, asMeera);

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("orphaned photo after failed report insert", expect.objectContaining({ key: expect.stringMatching(/^reports\//) }));
  });

  it("refuses a cross-site request before reading the upload", async () => {
    const { app, store, mediaStorage, asMeera } = await setup();
    const res = await postReport(app, asMeera).set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(store.reports.size).toBe(0);
    expect(mediaStorage.files.size).toBe(0);
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
      voteCount: 0,
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
          createdAt: photo.createdAt.toISOString(),
        },
      ],
      isMine: true,
      createdBy: { id: meera.id, name: "Meera Iyer" },
      voteCount: 0,
      hasVoted: false,
      resolvedAt: null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      statusHistory: [],
    });
  });

  it("shows the reporter's name to managers and the author, but not to other residents", async () => {
    const { app, store, greenPark, meera, asMeera, asFarhan, asManager } = await setup();
    const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
    const createdBy = async (cookie: string) =>
      (await request(app).get(`/api/reports/${report.id}`).set("Cookie", cookie)).body.data.createdBy;

    expect(await createdBy(asMeera)).toEqual({ id: meera.id, name: "Meera Iyer" });
    expect(await createdBy(asManager)).toEqual({ id: meera.id, name: "Meera Iyer" });
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
