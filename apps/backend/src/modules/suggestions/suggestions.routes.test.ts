import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";
import { GPS_MARKER, makeJpeg, makePng } from "../../../test/helpers/images.js";
import { SuggestionError, type SuggestionDraft, type SuggestionProvider } from "../../providers/suggestion.provider.js";
import { SUGGESTION_LIMIT } from "./suggestions.routes.js";

async function setup(provider: SuggestionProvider | null) {
  const ctx = createTestApp({}, { suggestionProvider: provider });
  const society = addSociety(ctx.store);
  const meera = await addUser(ctx.store, { role: "RESIDENT", societyId: society.id });
  const newAdmin = await addUser(ctx.store, { role: "ADMIN" });
  return { ...ctx, asMeera: sessionCookie(ctx.store, meera.id, ctx.clock.now), asNewAdmin: sessionCookie(ctx.store, newAdmin.id, ctx.clock.now) };
}

const fakeProvider = (impl?: SuggestionProvider["suggest"]) => {
  const suggest = vi.fn<SuggestionProvider["suggest"]>(
    impl ?? (async () => ({ title: "Streetlight out near Block C", category: "STREETLIGHTS" as const, description: "The streetlight near Block C has been off for 3 days." })),
  );
  return { suggest };
};

const body = { title: "lite gone", description: "street lite near block c not working since 3 days" };

describe("GET /api/features", () => {
  it("says whether AI suggestions are on", async () => {
    const on = await setup(fakeProvider());
    expect((await request(on.app).get("/api/features").set("Cookie", on.asMeera)).body).toEqual({ data: { aiSuggestions: true } });
    const off = await setup(null);
    expect((await request(off.app).get("/api/features").set("Cookie", off.asMeera)).body).toEqual({ data: { aiSuggestions: false } });
    expect((await request(off.app).get("/api/features")).status).toBe(401);
  });
});

describe("POST /api/reports/suggest", () => {
  it("returns the provider's suggestion and stores nothing", async () => {
    const provider = fakeProvider();
    const { app, store, asMeera } = await setup(provider);

    const res = await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send({ ...body, title: "  lite gone  " });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({
      data: { title: "Streetlight out near Block C", category: "STREETLIGHTS", description: "The streetlight near Block C has been off for 3 days." },
    });
    expect(provider.suggest).toHaveBeenCalledWith({ title: "lite gone", description: body.description });
    expect(store.reports.size).toBe(0);
  });

  it("says 503 when the feature is off", async () => {
    const { app, asMeera } = await setup(null);
    const res = await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send(body);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SUGGESTIONS_UNAVAILABLE");
  });

  it("maps a provider failure to 502 and logs only the reason", async () => {
    const { app, logger, asMeera } = await setup(fakeProvider(async () => { throw new SuggestionError("Gemini HTTP 429"); }));
    const res = await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send(body);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: "SUGGESTION_FAILED", message: "Couldn't get a suggestion right now. You can carry on without it." });
    expect(logger.warn).toHaveBeenCalledWith("suggestion failed", { userId: expect.any(String), reason: "Gemini HTTP 429" });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("street lite");
  });

  it("validates the draft before calling the provider", async () => {
    const provider = fakeProvider();
    const { app, asMeera } = await setup(provider);
    const res = await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send({ description: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.description).toEqual(["Add a photo or write at least 10 characters first"]);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it("works from a photo alone, sending Gemini only the cleaned image", async () => {
    const provider = fakeProvider();
    const { app, asMeera } = await setup(provider);

    const res = await request(app)
      .post("/api/reports/suggest")
      .set("Cookie", asMeera)
      .attach("photo", makeJpeg({ orientation: 6 }), { filename: "IMG_2041.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    const draft = provider.suggest.mock.calls[0]?.[0] as SuggestionDraft;
    expect(draft.description).toBeUndefined();
    expect(draft.photo?.mimeType).toBe("image/jpeg");
    expect(draft.photo?.bytes.includes(Buffer.from(GPS_MARKER))).toBe(false);
  });

  it("checks the photo like a report photo", async () => {
    const provider = fakeProvider();
    const { app, asMeera } = await setup(provider);
    const res = await request(app)
      .post("/api/reports/suggest")
      .set("Cookie", asMeera)
      .attach("photo", makePng(), { filename: "renamed.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(415);
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it(`allows ${SUGGESTION_LIMIT} per user per 10 minutes`, async () => {
    const provider = fakeProvider();
    const { app, clock, asMeera } = await setup(provider);
    for (let i = 0; i < SUGGESTION_LIMIT; i++) expect((await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send(body)).status).toBe(200);

    const limited = await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send(body);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(provider.suggest).toHaveBeenCalledTimes(SUGGESTION_LIMIT);

    clock.advance(10 * 60 * 1000);
    expect((await request(app).post("/api/reports/suggest").set("Cookie", asMeera).send(body)).status).toBe(200);
  });

  it("needs a session, a society and a same-site request", async () => {
    const { app, asMeera, asNewAdmin } = await setup(fakeProvider());
    expect((await request(app).post("/api/reports/suggest").send(body)).status).toBe(401);
    expect((await request(app).post("/api/reports/suggest").set("Cookie", asNewAdmin).send(body)).status).toBe(403);
    expect((await request(app).post("/api/reports/suggest").set("Cookie", asMeera).set("Origin", "https://evil.example").send(body)).status).toBe(403);
  });
});
