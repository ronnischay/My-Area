import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, inviteToken, sessionCookie } from "../../../test/helpers/factories.js";
import { hashToken } from "../../lib/tokens.js";

/** An admin (in no society). Green Park: a manager and a resident. Lake View: a manager and a resident. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", name: "Asha Rao", email: "asha@myarea.example" });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma", email: "rohit@greenpark.example" });
  const resident = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer", email: "meera@greenpark.example" });
  await addUser(store, { role: "MANAGER", societyId: lakeView.id, name: "Vikram Das", email: "vikram@lakeview.example" });
  const otherResident = await addUser(store, { role: "RESIDENT", societyId: lakeView.id, email: "neha@lakeview.example" });
  const cookie = (userId: string) => sessionCookie(store, userId, clock.now);
  return {
    ...ctx,
    greenPark,
    lakeView,
    admin,
    manager,
    resident,
    otherResident,
    cookie,
    asAdmin: cookie(admin.id),
    asManager: cookie(manager.id),
    members: (societyId: string) => `/api/societies/${societyId}/members`,
  };
}

const priya = { name: "Priya Menon", email: " Priya.Menon@Gmail.com ", role: "RESIDENT" };
const unknownId = "7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10";

describe("access to /api/societies/:societyId/members", () => {
  it("is for admins (any society) and managers (their own); residents get 403", async () => {
    const { app, cookie, resident, asAdmin, asManager, greenPark, lakeView, members } = await setup();

    expect((await request(app).get(members(greenPark.id))).status).toBe(401);
    expect((await request(app).get(members(greenPark.id)).set("Cookie", asAdmin)).status).toBe(200);
    expect((await request(app).get(members(lakeView.id)).set("Cookie", asAdmin)).status).toBe(200);
    expect((await request(app).get(members(greenPark.id)).set("Cookie", asManager)).status).toBe(200);
    expect((await request(app).get(members(greenPark.id)).set("Cookie", cookie(resident.id))).status).toBe(403);
  });

  it("treats another society like an unknown one for a manager, and an unknown society as 404 for an admin", async () => {
    const { app, asAdmin, asManager, lakeView, members } = await setup();

    const foreign = await request(app).get(members(lakeView.id)).set("Cookie", asManager);
    const unknown = await request(app).get(members(unknownId)).set("Cookie", asAdmin);

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body.error.message).toBe(unknown.body.error.message);
    expect((await request(app).post(members(lakeView.id)).set("Cookie", asManager).send(priya)).status).toBe(404);
    expect((await request(app).get(members("nope")).set("Cookie", asAdmin)).status).toBe(400);
  });
});

describe("POST …/members (invite)", () => {
  it("lets an admin invite into any society, without joining it, and emails a working link", async () => {
    const { app, store, asAdmin, admin, lakeView, emailSender, members } = await setup();

    const res = await request(app).post(members(lakeView.id)).set("Cookie", asAdmin).send({ ...priya, role: "MANAGER" });

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.meta).toEqual({ invite: "SENT" });
    expect(res.body.data).toMatchObject({
      name: "Priya Menon",
      email: "priya.menon@gmail.com",
      role: "MANAGER",
      status: "INVITED",
      inviteExpiresAt: "2026-10-31T10:00:00.000Z",
      lastLoginAt: null,
    });

    const member = store.users.get(res.body.data.id);
    expect(member).toMatchObject({ societyId: lakeView.id, invitedById: admin.id, passwordHash: null });
    expect(admin.societyId).toBeNull();

    expect(emailSender.sent).toHaveLength(1);
    const email = emailSender.sent[0];
    expect(email?.to).toBe("priya.menon@gmail.com");
    expect(email?.subject).toBe("You're invited to Lake View Towers on MyArea");
    expect(email?.text).toContain("Asha Rao has invited you to join Lake View Towers on MyArea as a manager.");
    const token = email?.text.match(/invite\?token=([\w-]+)/)?.[1];
    expect(token).toBeDefined();
    // The emailed token is the one whose hash is stored, and it works.
    expect(store.invites.get(member?.id ?? "")?.tokenHash).toBe(hashToken(token ?? ""));
    const lookup = await request(app).post("/api/auth/invites/lookup").send({ token });
    expect(lookup.body.data).toMatchObject({ email: "priya.menon@gmail.com", societyName: "Lake View Towers" });
    // The token never comes back in the API response.
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("keeps the member and reports FAILED when the email can't be sent", async () => {
    const { app, store, asAdmin, greenPark, emailSender, logger, members } = await setup();
    emailSender.failWith = new Error("connect ECONNREFUSED smtp.example.com:587");

    const res = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send(priya);

    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ invite: "FAILED" });
    expect(store.users.get(res.body.data.id)?.status).toBe("INVITED");
    expect(logger.warn).toHaveBeenCalledWith("invite email failed", expect.objectContaining({ userId: res.body.data.id }));
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });

  it("validates the input and never allows inviting an admin", async () => {
    const { app, asAdmin, greenPark, members } = await setup();

    const res = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send({ name: "P", email: "not-an-email", role: "ADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toEqual({
      name: ["Name must be at least 2 characters"],
      email: ["Enter a valid email address"],
      role: ["Choose Resident or Manager"],
    });
  });
});

describe("one society per person", () => {
  it("refuses someone who already belongs to another society with 409 ALREADY_IN_SOCIETY", async () => {
    const { app, store, asAdmin, greenPark, otherResident, emailSender, members } = await setup();
    const usersBefore = store.users.size;

    const res = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send({ ...priya, email: "NEHA@lakeview.example" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_IN_SOCIETY");
    const message = "This person already belongs to another society. A person can be in only one society.";
    expect(res.body.error.message).toBe(message);
    expect(res.body.error.details.fieldErrors.email).toEqual([message]);
    expect(store.users.get(otherResident.id)?.societyId).not.toBe(greenPark.id);
    expect(store.users.size).toBe(usersBefore);
    expect(emailSender.sent).toHaveLength(0);
  });

  it("refuses a manager of another society, and an invited (not yet joined) member of another society", async () => {
    const { app, store, asAdmin, greenPark, lakeView, members } = await setup();
    await addUser(store, { societyId: lakeView.id, status: "INVITED", email: "kabir@example.com" });

    const manager = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send({ ...priya, email: "vikram@lakeview.example", role: "MANAGER" });
    const invited = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send({ ...priya, email: "kabir@example.com" });

    expect(manager.body.error.code).toBe("ALREADY_IN_SOCIETY");
    expect(invited.body.error.code).toBe("ALREADY_IN_SOCIETY");
  });

  it("says when the person is already in this society, and when the email is an admin's", async () => {
    const { app, asAdmin, asManager, greenPark, members } = await setup();

    const here = await request(app).post(members(greenPark.id)).set("Cookie", asManager).send({ ...priya, email: "meera@greenpark.example" });
    const admin = await request(app).post(members(greenPark.id)).set("Cookie", asAdmin).send({ ...priya, email: "asha@myarea.example" });

    expect(here.status).toBe(409);
    expect(here.body.error).toMatchObject({ code: "EMAIL_TAKEN", message: "This person is already a member of this society." });
    expect(admin.status).toBe(409);
    expect(admin.body.error).toMatchObject({ code: "EMAIL_TAKEN", message: "This email belongs to an admin account." });
  });
});

describe("GET …/members", () => {
  it("lists only the chosen society, newest first, with filters and pagination", async () => {
    const { app, store, asAdmin, greenPark, lakeView, members } = await setup();
    await addUser(store, { societyId: greenPark.id, status: "INVITED", name: "Farhan Qureshi" });

    const all = await request(app).get(members(greenPark.id)).set("Cookie", asAdmin);
    expect(all.status).toBe(200);
    expect(all.body.data.map((m: { name: string }) => m.name)).toEqual(["Farhan Qureshi", "Meera Iyer", "Rohit Sharma"]);
    expect(all.body.meta).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
    expect(JSON.stringify(all.body)).not.toMatch(/lakeview|asha/);

    const managers = await request(app).get(`${members(greenPark.id)}?role=MANAGER`).set("Cookie", asAdmin);
    expect(managers.body.data.map((m: { name: string }) => m.name)).toEqual(["Rohit Sharma"]);

    const search = await request(app).get(`${members(greenPark.id)}?q=MEERA`).set("Cookie", asAdmin);
    expect(search.body.data).toHaveLength(1);

    const page2 = await request(app).get(`${members(greenPark.id)}?page=2&pageSize=2`).set("Cookie", asAdmin);
    expect(page2.body.data.map((m: { name: string }) => m.name)).toEqual(["Rohit Sharma"]);
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });

    const other = await request(app).get(members(lakeView.id)).set("Cookie", asAdmin);
    expect(other.body.meta.total).toBe(2);
  });

  it("rejects bad query values", async () => {
    const { app, asAdmin, greenPark, members } = await setup();

    const res = await request(app).get(`${members(greenPark.id)}?pageSize=500&status=SLEEPING`).set("Cookie", asAdmin);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["pageSize", "status"]);
  });
});

describe("POST …/members/:id/invite (resend)", () => {
  it("replaces the invite: the old link stops working, the new one works", async () => {
    const { app, store, clock, asAdmin, greenPark, emailSender, members } = await setup();
    const invited = await addUser(store, { societyId: greenPark.id, status: "INVITED", email: "farhan@example.com" });
    const oldToken = inviteToken(store, invited.id, clock.now);
    clock.advance(60 * 60 * 1000);

    const res = await request(app).post(`${members(greenPark.id)}/${invited.id}/invite`).set("Cookie", asAdmin);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ invite: "SENT" });
    expect(res.body.data.inviteExpiresAt).toBe("2026-10-31T11:00:00.000Z");
    const newToken = emailSender.sent[0]?.text.match(/invite\?token=([\w-]+)/)?.[1];
    expect((await request(app).post("/api/auth/invites/lookup").send({ token: oldToken })).status).toBe(410);
    expect((await request(app).post("/api/auth/invites/lookup").send({ token: newToken })).status).toBe(200);
  });

  it("returns 409 USER_NOT_INVITED for an active member", async () => {
    const { app, asAdmin, greenPark, resident, members } = await setup();

    const res = await request(app).post(`${members(greenPark.id)}/${resident.id}/invite`).set("Cookie", asAdmin);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USER_NOT_INVITED");
  });
});

describe("managers", () => {
  it("invite residents to their own society, recorded as the inviter", async () => {
    const { app, store, asManager, manager, greenPark, emailSender, members } = await setup();

    const res = await request(app).post(members(greenPark.id)).set("Cookie", asManager).send(priya);

    expect(res.status).toBe(201);
    expect(store.users.get(res.body.data.id)).toMatchObject({ societyId: greenPark.id, invitedById: manager.id, role: "RESIDENT" });
    expect(emailSender.sent[0]?.text).toContain("Rohit Sharma has invited you to join Green Park Residency on MyArea as a resident.");
  });

  it("can't invite a manager", async () => {
    const { app, store, asManager, greenPark, emailSender, members } = await setup();
    const usersBefore = store.users.size;

    const res = await request(app).post(members(greenPark.id)).set("Cookie", asManager).send({ ...priya, role: "MANAGER" });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Managers can only invite residents.");
    expect(store.users.size).toBe(usersBefore);
    expect(emailSender.sent).toHaveLength(0);
  });

  it("resend a resident's invite, but not a manager's", async () => {
    const { app, store, asManager, greenPark, members } = await setup();
    const resident = await addUser(store, { societyId: greenPark.id, status: "INVITED", email: "farhan@example.com" });
    const manager = await addUser(store, { societyId: greenPark.id, role: "MANAGER", status: "INVITED", email: "kabir@example.com" });

    expect((await request(app).post(`${members(greenPark.id)}/${resident.id}/invite`).set("Cookie", asManager)).status).toBe(200);
    expect((await request(app).post(`${members(greenPark.id)}/${manager.id}/invite`).set("Cookie", asManager)).status).toBe(403);
  });

  it("can't change roles or disable anyone", async () => {
    const { app, store, asManager, greenPark, resident, members } = await setup();

    expect((await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asManager).send({ disabled: true })).status).toBe(403);
    expect((await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asManager).send({ role: "MANAGER" })).status).toBe(403);
    expect(store.users.get(resident.id)).toMatchObject({ role: "RESIDENT", status: "ACTIVE" });
  });
});

describe("PATCH …/members/:id (admin)", () => {
  it("changes a member's role", async () => {
    const { app, asAdmin, greenPark, resident, members } = await setup();

    const res = await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asAdmin).send({ role: "MANAGER" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: resident.id, role: "MANAGER", status: "ACTIVE" });
  });

  it("disabling signs the member out at once; enabling restores ACTIVE, or INVITED without a password", async () => {
    const { app, store, clock, asAdmin, resident, greenPark, members } = await setup();
    const residentCookie = sessionCookie(store, resident.id, clock.now);
    expect((await request(app).get("/api/auth/me").set("Cookie", residentCookie)).status).toBe(200);

    const disabled = await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asAdmin).send({ disabled: true });
    expect(disabled.body.data.status).toBe("DISABLED");
    expect((await request(app).get("/api/auth/me").set("Cookie", residentCookie)).status).toBe(401);

    const enabled = await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asAdmin).send({ disabled: false });
    expect(enabled.body.data.status).toBe("ACTIVE");

    const invited = await addUser(store, { societyId: greenPark.id, status: "INVITED" });
    inviteToken(store, invited.id, clock.now);
    await request(app).patch(`${members(greenPark.id)}/${invited.id}`).set("Cookie", asAdmin).send({ disabled: true });
    expect(store.invites.has(invited.id)).toBe(false);
    const back = await request(app).patch(`${members(greenPark.id)}/${invited.id}`).set("Cookie", asAdmin).send({ disabled: false });
    expect(back.body.data.status).toBe("INVITED");
  });

  it("validates the id and the body", async () => {
    const { app, asAdmin, greenPark, resident, members } = await setup();

    const badId = await request(app).patch(`${members(greenPark.id)}/not-a-uuid`).set("Cookie", asAdmin).send({ disabled: true });
    const empty = await request(app).patch(`${members(greenPark.id)}/${resident.id}`).set("Cookie", asAdmin).send({});

    expect(badId.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});

describe("tenant isolation", () => {
  it("treats a member of another society as not found for every action, even for an admin", async () => {
    const { app, asAdmin, greenPark, otherResident, members } = await setup();

    const resend = await request(app).post(`${members(greenPark.id)}/${otherResident.id}/invite`).set("Cookie", asAdmin);
    const update = await request(app).patch(`${members(greenPark.id)}/${otherResident.id}`).set("Cookie", asAdmin).send({ disabled: true });

    expect(resend.status).toBe(404);
    expect(update.status).toBe(404);
    expect(update.body.error.code).toBe("NOT_FOUND");
    expect(otherResident.status).toBe("ACTIVE");
  });
});
