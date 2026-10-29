import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { reportStatusHistory, reports } from "../../db/schema/index.js";
import { createReportsRepository, type NewReport } from "./reports.repository.js";
import { canTransition } from "./status-transitions.js";

const at = new Date("2026-10-29T10:00:00.000Z");

function newReport(societyId: string, createdById: string): NewReport {
  const id = randomUUID();
  return {
    societyId,
    createdById,
    title: "Streetlight out near Block C",
    description: "The pole light facing the Block C gate has been off for a week.",
    category: "STREETLIGHTS",
    locationText: "Block C main gate",
    photo: { id, mediaType: "IMAGE", url: `/api/media/${id}`, providerPublicId: `reports/${id}.jpg`, mimeType: "image/jpeg", sizeBytes: 1000, width: 800, height: 600, originalFilename: null },
  };
}

describe.skipIf(!testDatabaseUrl)("report status + management (PostgreSQL)", () => {
  const db = useTestDatabase();

  async function setup() {
    const repo = createReportsRepository(db);
    const greenPark = await insertSociety(db, "Green Park Residency");
    const lakeView = await insertSociety(db, "Lake View Towers");
    const meera = await insertUser(db, { email: "meera@greenpark.example", role: "RESIDENT", societyId: greenPark.id });
    const rohit = await insertUser(db, { email: "rohit@greenpark.example", role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma" });
    const report = await repo.create(newReport(greenPark.id, meera.id));
    const change = (to: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED", societyId = greenPark.id, note: string | null = null) =>
      repo.changeStatus({ societyId, reportId: report.id, to, note, changedById: rohit.id, at, isAllowed: canTransition });
    return { repo, greenPark, lakeView, meera, rohit, report, change };
  }

  it("updates the report and adds a history row together; resolvedAt follows RESOLVED", async () => {
    const { change, rohit } = await setup();

    expect((await change("IN_PROGRESS", undefined, "Booked")).outcome).toBe("CHANGED");
    const resolved = await change("RESOLVED");

    expect(resolved).toMatchObject({ outcome: "CHANGED", report: { status: "RESOLVED", resolvedAt: at } });
    if (resolved.outcome !== "CHANGED") throw new Error("expected a change");
    expect(resolved.report.statusHistory.map((h) => [h.fromStatus, h.toStatus, h.note, h.changedBy.name])).toEqual([
      ["OPEN", "IN_PROGRESS", "Booked", "Rohit Sharma"],
      ["IN_PROGRESS", "RESOLVED", null, "Rohit Sharma"],
    ]);
    expect(resolved.report.statusHistory[0]?.changedBy.id).toBe(rohit.id);
  });

  it("refuses a disallowed transition and another society's report without writing anything", async () => {
    const { change, lakeView } = await setup();

    expect(await change("RESOLVED")).toEqual({ outcome: "REFUSED", from: "OPEN" });
    expect(await change("IN_PROGRESS", lakeView.id)).toEqual({ outcome: "NOT_FOUND" });
    expect(await db.select().from(reportStatusHistory)).toEqual([]);
    expect((await db.select({ status: reports.status }).from(reports))[0]?.status).toBe("OPEN");
  });

  it("lets only one of two simultaneous identical changes through (row lock)", async () => {
    const { repo, greenPark, rohit, report } = await setup();
    // Each call waits (up to 300 ms) for the other to reach the rule check. Without the row lock both
    // get there having read OPEN and both write; with it, the second is blocked until the first commits.
    let arrived = 0;
    const isAllowed = async (from: Parameters<typeof canTransition>[0], to: Parameters<typeof canTransition>[1]) => {
      arrived += 1;
      for (let waited = 0; arrived < 2 && waited < 300; waited += 10) await new Promise((r) => setTimeout(r, 10));
      return canTransition(from, to);
    };
    const change = () =>
      repo.changeStatus({ societyId: greenPark.id, reportId: report.id, to: "IN_PROGRESS", note: null, changedById: rohit.id, at, isAllowed });

    const results = await Promise.all([change(), change()]);

    expect(results.map((r) => r.outcome).sort()).toEqual(["CHANGED", "REFUSED"]);
    expect(await db.select().from(reportStatusHistory)).toHaveLength(1);
  });

  it("enforces from <> to in the database and deletes history with the report", async () => {
    const { report, rohit, change } = await setup();
    let code: string | undefined;
    try {
      await db.insert(reportStatusHistory).values({ reportId: report.id, fromStatus: "OPEN", toStatus: "OPEN", changedById: rohit.id });
    } catch (err) {
      code = ((err as { cause?: { code?: string } }).cause ?? (err as { code?: string })).code;
    }
    expect(code).toBe("23514");

    await change("IN_PROGRESS");
    await db.delete(reports);
    expect(await db.select().from(reportStatusHistory)).toEqual([]);
  });

  it("adds resolution media only within the society, and counts reports per status", async () => {
    const { repo, greenPark, lakeView, meera, rohit, report, change } = await setup();
    const id = randomUUID();
    const media = { id, mediaType: "IMAGE" as const, url: `/api/media/${id}`, providerPublicId: `reports/${id}.jpg`, mimeType: "image/jpeg", sizeBytes: 900, width: 600, height: 800, originalFilename: "fixed.jpg", uploadedById: rohit.id };

    expect(await repo.addResolutionMedia(lakeView.id, report.id, media)).toBeNull();
    expect(await repo.addResolutionMedia(greenPark.id, report.id, media)).toMatchObject({ id, purpose: "RESOLUTION", width: 600 });

    await repo.create(newReport(greenPark.id, meera.id));
    await change("REJECTED");
    expect(await repo.countByStatus(greenPark.id)).toEqual({ OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 1 });
    expect(await repo.countByStatus(lakeView.id)).toEqual({ OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 });
  });
});
