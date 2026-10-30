import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addReport, addSociety, addUser, sessionCookie } from "../../../test/helpers/factories.js";

async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const meera = await addUser(store, { role: "RESIDENT", societyId: greenPark.id });
  const farhan = await addUser(store, { role: "RESIDENT", societyId: greenPark.id });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id });
  const neha = await addUser(store, { role: "RESIDENT", societyId: lakeView.id });
  const report = addReport(store, { societyId: greenPark.id, createdById: meera.id });
  const cookie = (id: string) => sessionCookie(store, id, clock.now);
  return { ...ctx, greenPark, meera, report, asMeera: cookie(meera.id), asFarhan: cookie(farhan.id), asManager: cookie(manager.id), asNeha: cookie(neha.id) };
}

const vote = (app: Parameters<typeof request>[0], cookie: string, id: string) => request(app).post(`/api/reports/${id}/votes`).set("Cookie", cookie);
const unvote = (app: Parameters<typeof request>[0], cookie: string, id: string) => request(app).delete(`/api/reports/${id}/votes`).set("Cookie", cookie);

describe("thumbs-up (POST/DELETE /api/reports/:id/votes)", () => {
  it("adds and removes a thumbs-up, and the report and list show the count", async () => {
    const { app, report, asFarhan, asManager } = await setup();

    const first = await vote(app, asFarhan, report.id);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ data: { voteCount: 1, hasVoted: true } });
    expect((await vote(app, asManager, report.id)).body.data).toEqual({ voteCount: 2, hasVoted: true });

    const detail = await request(app).get(`/api/reports/${report.id}`).set("Cookie", asFarhan);
    expect(detail.body.data).toMatchObject({ voteCount: 2, hasVoted: true });
    const list = await request(app).get("/api/reports").set("Cookie", asFarhan);
    expect(list.body.data[0].voteCount).toBe(2);

    const removed = await unvote(app, asFarhan, report.id);
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ voteCount: 1, hasVoted: false });
    // Removing again changes nothing and isn't an error.
    expect((await unvote(app, asFarhan, report.id)).body.data).toEqual({ voteCount: 1, hasVoted: false });
  });

  it("allows one thumbs-up per person", async () => {
    const { app, report, asFarhan } = await setup();
    await vote(app, asFarhan, report.id);
    const again = await vote(app, asFarhan, report.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_VOTED");
  });

  it("refuses your own report, closed reports and other societies", async () => {
    const { app, store, report, asMeera, asFarhan, asNeha } = await setup();

    const own = await vote(app, asMeera, report.id);
    expect(own.status).toBe(403);
    expect(own.body.error.message).toBe("You can't give a thumbs-up to your own report.");

    expect((await vote(app, asNeha, report.id)).status).toBe(404);

    store.reports.get(report.id)!.status = "REJECTED";
    const closed = await vote(app, asFarhan, report.id);
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("VOTING_CLOSED");
    expect(store.votes.size).toBe(0);
  });

  it("needs a session, a valid id and a same-site request", async () => {
    const { app, report, asFarhan } = await setup();
    expect((await request(app).post(`/api/reports/${report.id}/votes`)).status).toBe(401);
    expect((await vote(app, asFarhan, "nope")).status).toBe(400);
    expect((await vote(app, asFarhan, report.id).set("Origin", "https://evil.example")).status).toBe(403);
  });
});
