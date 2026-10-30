import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addReport, addReportMedia, addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";
import { makePng } from "../../../test/helpers/images.js";

async function setup() {
  const ctx = createTestApp();
  const { store, clock, mediaStorage } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const meera = await addUser(store, { role: "RESIDENT", societyId: greenPark.id });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id });
  const neha = await addUser(store, { role: "RESIDENT", societyId: lakeView.id });
  const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
  const photo = addReportMedia(store, { reportId: report.id, mimeType: "image/png" });
  const bytes = makePng();
  await mediaStorage.save(photo.providerPublicId, bytes);
  return {
    ...ctx,
    photo,
    bytes,
    asMeera: sessionCookie(store, meera.id, clock.now),
    asManager: sessionCookie(store, manager.id, clock.now),
    asNeha: sessionCookie(store, neha.id, clock.now),
  };
}

describe("GET /api/media/:id", () => {
  it("serves the photo to members of the report's society", async () => {
    const { app, photo, bytes, asMeera, asManager } = await setup();

    for (const cookie of [asMeera, asManager]) {
      const res = await request(app).get(photo.url).set("Cookie", cookie).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["content-length"]).toBe(String(bytes.length));
      expect(res.headers["cache-control"]).toBe("private, max-age=86400, immutable");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
      expect(Buffer.from(res.body)).toEqual(bytes);
    }
  });

  it("needs a session", async () => {
    const { app, photo } = await setup();
    expect((await request(app).get(photo.url)).status).toBe(401);
  });

  it("returns 404 for another society's photo, exactly like an unknown id", async () => {
    const { app, photo, asNeha, asMeera } = await setup();

    const foreign = await request(app).get(photo.url).set("Cookie", asNeha);
    const unknown = await request(app).get("/api/media/7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10").set("Cookie", asMeera);

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error).toMatchObject({ code: "NOT_FOUND", message: unknown.body.error.message });
  });

  it("returns 404 and logs when the file is missing from storage", async () => {
    const { app, photo, mediaStorage, logger, asMeera } = await setup();
    await mediaStorage.delete(photo.providerPublicId);

    const res = await request(app).get(photo.url).set("Cookie", asMeera);

    expect(res.status).toBe(404);
    expect(logger.error).toHaveBeenCalledWith("photo file missing from storage", { mediaId: photo.id });
  });

  it("rejects an id that isn't a UUID", async () => {
    const { app, asMeera } = await setup();
    const res = await request(app).get("/api/media/..%2F..%2Fetc%2Fpasswd").set("Cookie", asMeera);
    expect(res.status).toBe(400);
  });
});
