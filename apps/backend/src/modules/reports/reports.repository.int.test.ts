import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { reportMedia, reports } from "../../db/schema/index.js";
import { createReportsRepository } from "./reports.repository.js";

const fields = {
  title: "Overflowing bins at Block A",
  description: "The bins behind Block A have not been cleared since Monday.",
  category: "WASTE",
  locationText: "Behind Block A",
} as const;

const page = { sort: "newest", page: 1, pageSize: 20 } as const;

/** Postgres error code anywhere in the Drizzle cause chain. */
async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    let current: unknown = err;
    while (current && typeof current === "object") {
      const { code, cause } = current as { code?: unknown; cause?: unknown };
      if (typeof code === "string") return code;
      current = cause;
    }
  }
  return undefined;
}

describe.skipIf(!testDatabaseUrl)("reports repository (PostgreSQL)", () => {
  const db = useTestDatabase();

  async function twoSocieties() {
    const greenPark = await insertSociety(db, "Green Park Residency");
    const lakeView = await insertSociety(db, "Lake View Towers");
    const meera = await insertUser(db, { email: "meera@greenpark.example", role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer" });
    const farhan = await insertUser(db, { email: "farhan@greenpark.example", role: "RESIDENT", societyId: greenPark.id });
    const neha = await insertUser(db, { email: "neha@lakeview.example", role: "RESIDENT", societyId: lakeView.id });
    return { greenPark, lakeView, meera, farhan, neha };
  }

  it("creates a report and reads it back with its author and media", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();

    const created = await repo.create({ ...fields, societyId: greenPark.id, createdById: meera.id });
    expect(created).toMatchObject({ ...fields, status: "OPEN", resolvedAt: null, media: [], createdBy: { id: meera.id, name: "Meera Iyer" } });

    await db.insert(reportMedia).values({
      reportId: created.id,
      mediaType: "IMAGE",
      url: "https://res.cloudinary.com/demo/image/upload/a.jpg",
      providerPublicId: "myarea/test/a",
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      width: 800,
      height: 600,
      uploadedById: meera.id,
    });

    const found = await repo.findById(greenPark.id, created.id);
    expect(found?.media).toEqual([expect.objectContaining({ purpose: "SUBMISSION", width: 800, height: 600 })]);
    expect(found?.media[0]).not.toHaveProperty("providerPublicId");
  });

  it("never reads across societies", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, lakeView, meera, neha } = await twoSocieties();
    const ours = await repo.create({ ...fields, societyId: greenPark.id, createdById: meera.id });
    await repo.create({ ...fields, title: "Lift stuck on floor 3", societyId: lakeView.id, createdById: neha.id });

    expect(await repo.findById(lakeView.id, ours.id)).toBeNull();
    const list = await repo.list(greenPark.id, page);
    expect(list.total).toBe(1);
    expect(list.items.map((r) => r.id)).toEqual([ours.id]);
  });

  it("filters, searches literally, sorts and counts", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera, farhan } = await twoSocieties();
    const bins = await repo.create({ ...fields, societyId: greenPark.id, createdById: meera.id });
    const light = await repo.create({
      ...fields,
      title: "Light flickering",
      category: "STREETLIGHTS",
      locationText: "Clubhouse 50% corridor",
      societyId: greenPark.id,
      createdById: farhan.id,
    });
    const swing = await repo.create({ ...fields, title: "Broken swing", category: "PARKS", societyId: greenPark.id, createdById: farhan.id });

    const ids = async (query: Partial<Parameters<typeof repo.list>[1]>) =>
      (await repo.list(greenPark.id, { ...page, ...query })).items.map((r) => r.id);

    expect(await ids({})).toEqual([swing.id, light.id, bins.id]);
    expect(await ids({ sort: "oldest" })).toEqual([bins.id, light.id, swing.id]);
    expect(await ids({ category: "PARKS" })).toEqual([swing.id]);
    expect(await ids({ createdById: meera.id })).toEqual([bins.id]);
    expect(await ids({ q: "50%" })).toEqual([light.id]);
    expect(await ids({ q: "%" })).toEqual([light.id]);
    expect(await ids({ q: "CLUBHOUSE" })).toEqual([light.id]);
    expect(await ids({ status: "RESOLVED" })).toEqual([]);

    const page2 = await repo.list(greenPark.id, { ...page, page: 2, pageSize: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items.map((r) => r.id)).toEqual([bins.id]);
  });

  it("uses the first SUBMISSION photo as the thumbnail", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    const report = await repo.create({ ...fields, societyId: greenPark.id, createdById: meera.id });
    const media = (n: string, purpose: "SUBMISSION" | "RESOLUTION") => ({
      reportId: report.id,
      purpose,
      mediaType: "IMAGE" as const,
      url: `https://res.cloudinary.com/demo/image/upload/${n}.jpg`,
      providerPublicId: `myarea/test/${n}`,
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      uploadedById: meera.id,
    });
    await db.insert(reportMedia).values(media("resolution", "RESOLUTION"));
    await db.insert(reportMedia).values(media("submission", "SUBMISSION"));

    const [item] = (await repo.list(greenPark.id, page)).items;
    expect(item?.thumbnailUrl).toBe("https://res.cloudinary.com/demo/image/upload/submission.jpg");
  });

  it("enforces the schema rules in the database", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera, neha } = await twoSocieties();

    // reports_created_by_same_society_fk: a reporter from another society is rejected (23503).
    expect(await pgErrorCode(repo.create({ ...fields, societyId: greenPark.id, createdById: neha.id }))).toBe("23503");

    const base = { ...fields, societyId: greenPark.id, createdById: meera.id };
    // reports_resolved_at_ck: RESOLVED needs resolved_at, and only RESOLVED may have it (23514).
    expect(await pgErrorCode(db.insert(reports).values({ ...base, status: "RESOLVED" }))).toBe("23514");
    expect(await pgErrorCode(db.insert(reports).values({ ...base, resolvedAt: new Date() }))).toBe("23514");
    await db.insert(reports).values({ ...base, status: "RESOLVED", resolvedAt: new Date() });

    // Unknown enum value (22P02).
    expect(await pgErrorCode(db.insert(reports).values({ ...base, category: "POTHOLES" as "ROADS" }))).toBe("22P02");

    const report = await repo.create(base);
    const media = {
      reportId: report.id,
      mediaType: "IMAGE" as const,
      url: "https://res.cloudinary.com/demo/image/upload/a.jpg",
      providerPublicId: "myarea/test/a",
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      uploadedById: meera.id,
    };
    // report_media_size_bytes_ck and report_media_dimensions_ck (23514), provider id unique (23505).
    expect(await pgErrorCode(db.insert(reportMedia).values({ ...media, sizeBytes: 0 }))).toBe("23514");
    expect(await pgErrorCode(db.insert(reportMedia).values({ ...media, width: 0 }))).toBe("23514");
    await db.insert(reportMedia).values(media);
    expect(await pgErrorCode(db.insert(reportMedia).values(media))).toBe("23505");
  });

  it("deletes a report's media with the report", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    const report = await repo.create({ ...fields, societyId: greenPark.id, createdById: meera.id });
    await db.insert(reportMedia).values({
      reportId: report.id,
      mediaType: "IMAGE",
      url: "https://res.cloudinary.com/demo/image/upload/a.jpg",
      providerPublicId: "myarea/test/a",
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      uploadedById: meera.id,
    });

    await db.delete(reports);
    expect(await db.select().from(reportMedia)).toEqual([]);
  });
});
