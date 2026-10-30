import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { reportMedia, reports } from "../../db/schema/index.js";
import { createMediaRepository } from "../media/media.repository.js";
import { type NewReport, createReportsRepository } from "./reports.repository.js";

const fields = {
  title: "Overflowing bins at Block A",
  description: "The bins behind Block A have not been cleared since Monday.",
  category: "WASTE",
  locationText: "Behind Block A",
} as const;

const page = { sort: "newest", page: 1, pageSize: 20 } as const;

/** A report with its required photo, as the service builds it. */
function newReport(societyId: string, createdById: string, overrides: Partial<Omit<NewReport, "photo">> = {}): NewReport {
  const id = randomUUID();
  return {
    ...fields,
    societyId,
    createdById,
    ...overrides,
    photo: {
      id,
      mediaType: "IMAGE",
      url: `/api/media/${id}`,
      providerPublicId: `reports/${id}.jpg`,
      mimeType: "image/jpeg",
    },
  };
}

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

  it("creates a report and its photo together and reads them back", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    const input = newReport(greenPark.id, meera.id);

    const created = await repo.create(input);

    expect(created).toMatchObject({ ...fields, status: "OPEN", resolvedAt: null, createdBy: { id: meera.id, name: "Meera Iyer" } });
    expect(created.media).toEqual([
      expect.objectContaining({ id: input.photo.id, purpose: "SUBMISSION", url: input.photo.url, mimeType: "image/jpeg" }),
    ]);
    // Storage key and original filename stay server-side.
    expect(created.media[0]).not.toHaveProperty("providerPublicId");
    const [row] = await db.select().from(reportMedia);
    expect(row).toMatchObject({ uploadedById: meera.id });
    expect(Object.keys(row!).sort()).toEqual(["createdAt", "id", "mediaType", "mimeType", "providerPublicId", "purpose", "reportId", "uploadedById", "url"]);
  });

  it("saves nothing when the photo row fails (one transaction)", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    const first = newReport(greenPark.id, meera.id);
    await repo.create(first);

    // Same storage key → report_media_provider_public_id_uq fails after the report row was inserted.
    const clash = newReport(greenPark.id, meera.id, { title: "Second report" });
    clash.photo.providerPublicId = first.photo.providerPublicId;
    expect(await pgErrorCode(repo.create(clash))).toBe("23505");

    expect(await db.select().from(reports)).toHaveLength(1);
    expect(await db.select().from(reportMedia)).toHaveLength(1);
  });

  it("never reads across societies", async () => {
    const repo = createReportsRepository(db);
    const media = createMediaRepository(db);
    const { greenPark, lakeView, meera, neha } = await twoSocieties();
    const ours = await repo.create(newReport(greenPark.id, meera.id));
    await repo.create(newReport(lakeView.id, neha.id, { title: "Lift stuck on floor 3" }));

    expect(await repo.findById(lakeView.id, ours.id)).toBeNull();
    const list = await repo.list(greenPark.id, page);
    expect(list.total).toBe(1);
    expect(list.items.map((r) => r.id)).toEqual([ours.id]);

    const photoId = ours.media[0]!.id;
    expect(await media.findForSociety(greenPark.id, photoId)).toEqual({
      providerPublicId: `reports/${photoId}.jpg`,
      mimeType: "image/jpeg",
    });
    expect(await media.findForSociety(lakeView.id, photoId)).toBeNull();
  });

  it("filters, searches literally, sorts and counts", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera, farhan } = await twoSocieties();
    const bins = await repo.create(newReport(greenPark.id, meera.id));
    const light = await repo.create(
      newReport(greenPark.id, farhan.id, { title: "Light flickering", category: "STREETLIGHTS", locationText: "Clubhouse 50% corridor" }),
    );
    const swing = await repo.create(newReport(greenPark.id, farhan.id, { title: "Broken swing", category: "PARKS" }));

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

  it("uses the submission photo as the thumbnail, never a resolution photo", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    const input = newReport(greenPark.id, meera.id);
    const report = await repo.create(input);
    await db.insert(reportMedia).values({
      reportId: report.id,
      purpose: "RESOLUTION",
      mediaType: "IMAGE",
      url: "/api/media/resolution",
      providerPublicId: "reports/resolution.jpg",
      mimeType: "image/jpeg",
      uploadedById: meera.id,
    });

    const [item] = (await repo.list(greenPark.id, page)).items;
    expect(item?.thumbnailUrl).toBe(input.photo.url);
  });

  it("enforces the schema rules in the database", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera, neha } = await twoSocieties();

    // reports_created_by_same_society_fk: a reporter from another society is rejected (23503).
    expect(await pgErrorCode(repo.create(newReport(greenPark.id, neha.id)))).toBe("23503");

    const base = { ...fields, societyId: greenPark.id, createdById: meera.id };
    // reports_resolved_at_ck: RESOLVED needs resolved_at, and only RESOLVED may have it (23514).
    expect(await pgErrorCode(db.insert(reports).values({ ...base, status: "RESOLVED" }))).toBe("23514");
    expect(await pgErrorCode(db.insert(reports).values({ ...base, resolvedAt: new Date() }))).toBe("23514");
    await db.insert(reports).values({ ...base, status: "RESOLVED", resolvedAt: new Date() });

    // Unknown enum value (22P02).
    expect(await pgErrorCode(db.insert(reports).values({ ...base, category: "POTHOLES" as "ROADS" }))).toBe("22P02");

    const report = await repo.create(newReport(greenPark.id, meera.id));
    const media = {
      reportId: report.id,
      mediaType: "IMAGE" as const,
      url: "/api/media/x",
      providerPublicId: "reports/x.jpg",
      mimeType: "image/jpeg",
      uploadedById: meera.id,
    };
    // Each stored file belongs to exactly one row (report_media_provider_public_id_uq, 23505).
    await db.insert(reportMedia).values(media);
    expect(await pgErrorCode(db.insert(reportMedia).values(media))).toBe("23505");
  });

  it("deletes a report's media with the report", async () => {
    const repo = createReportsRepository(db);
    const { greenPark, meera } = await twoSocieties();
    await repo.create(newReport(greenPark.id, meera.id));

    await db.delete(reports);
    expect(await db.select().from(reportMedia)).toEqual([]);
  });
});
