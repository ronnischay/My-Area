import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, inviteToken, sessionCookie } from "../../../test/helpers/factories.js";
import { hashToken } from "../../lib/tokens.js";

/** Two societies, each with an admin; the first also has a manager and a resident. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const greenPark = addSociety(store, { name: "Green Park Residency" });
  const lakeView = addSociety(store, { name: "Lake View Towers" });
  const admin = await addUser(store, { role: "ADMIN", societyId: greenPark.id, name: "Asha Rao", email: "asha@greenpark.example" });
  const manager = await addUser(store, { role: "MANAGER", societyId: greenPark.id, name: "Rohit Sharma", email: "rohit@greenpark.example" });
  const resident = await addUser(store, { role: "RESIDENT", societyId: greenPark.id, name: "Meera Iyer", email: "meera@greenpark.example" });
  const otherAdmin = await addUser(store, { role: "ADMIN", societyId: lakeView.id, name: "Vikram Das", email: "vikram@lakeview.example" });
  const otherResident = await addUser(store, { role: "RESIDENT", societyId: lakeView.id, email: "neha@lakeview.example" });
  return {
    ...ctx,
    greenPark,
    admin,
    manager,
    resident,
    otherAdmin,
    otherResident,
    asAdmin: sessionCookie(store, admin.id, clock.now),
    asOtherAdmin: sessionCookie(store, otherAdmin.id, clock.now),
  };
}

const priya = { name: "Priya Menon", email: " Priya.Menon@Gmail.com ", role: "RESIDENT" };

describe("access to /api/admin/users", () => {
  it("is admin-only and needs a society", async () => {
    const { app, store, clock, manager, resident } = await setup();
    const newAdmin = await addUser(store, { role: "ADMIN" });

    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect((await request(app).get("/api/admin/users").set("Cookie", sessionCookie(store, manager.id, clock.now))).status).toBe(403);
    expect((await request(app).get("/api/admin/users").set("Cookie", sessionCookie(store, resident.id, clock.now))).status).toBe(403);

    const noSociety = await request(app).get("/api/admin/users").set("Cookie", sessionCookie(store, newAdmin.id, clock.now));
    expect(noSociety.status).toBe(403);
    expect(noSociety.body.error.code).toBe("SOCIETY_REQUIRED");
  });
});

describe("POST /api/admin/users (invite)", () => {
  it("creates an INVITED member in the admin's society and emails a working link", async () => {
    const { app, store, asAdmin, greenPark, admin, emailSender } = await setup();

    const res = await request(app).post("/api/admin/users").set("Cookie", asAdmin).send(priya);

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.meta).toEqual({ invite: "SENT" });
    expect(res.body.data).toMatchObject({
      name: "Priya Menon",
      email: "priya.menon@gmail.com",
      role: "RESIDENT",
      status: "INVITED",
      inviteExpiresAt: "2026-10-31T10:00:00.000Z",
      lastLoginAt: null,
    });

    const member = store.users.get(res.body.data.id);
    expect(member).toMatchObject({ societyId: greenPark.id, invitedById: admin.id, passwordHash: null });

    expect(emailSender.sent).toHaveLength(1);
    const email = emailSender.sent[0];
    expect(email?.to).toBe("priya.menon@gmail.com");
    expect(email?.subject).toBe("You're invited to Green Park Residency on MyArea");
    const token = email?.text.match(/invite\?token=([\w-]+)/)?.[1];
    expect(token).toBeDefined();
    // The emailed token is the one whose hash is stored, and it works.
    expect(store.invites.get(member?.id ?? "")?.tokenHash).toBe(hashToken(token ?? ""));
    const lookup = await request(app).post("/api/auth/invites/lookup").send({ token });
    expect(lookup.body.data).toMatchObject({ email: "priya.menon@gmail.com", societyName: "Green Park Residency" });
    // The token never comes back in the API response.
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("returns 409 EMAIL_TAKEN for an email that has an account in any society", async () => {
    const { app, asAdmin, emailSender } = await setup();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin)
      .send({ ...priya, email: "NEHA@lakeview.example" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(res.body.error.details.fieldErrors.email).toEqual(["This email already has a MyArea account."]);
    expect(emailSender.sent).toHaveLength(0);
  });

  it("keeps the member and reports FAILED when the email can't be sent", async () => {
    const { app, store, asAdmin, emailSender, logger } = await setup();
    emailSender.failWith = new Error("connect ECONNREFUSED smtp.example.com:587");

    const res = await request(app).post("/api/admin/users").set("Cookie", asAdmin).send(priya);

    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ invite: "FAILED" });
    expect(store.users.get(res.body.data.id)?.status).toBe("INVITED");
    expect(logger.warn).toHaveBeenCalledWith("invite email failed", expect.objectContaining({ userId: res.body.data.id }));
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });

  it("validates the input and never allows inviting an admin", async () => {
    const { app, asAdmin } = await setup();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin)
      .send({ name: "P", email: "not-an-email", role: "ADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toEqual({
      name: ["Name must be at least 2 characters"],
      email: ["Enter a valid email address"],
      role: ["Choose Resident or Manager"],
    });
  });
});

describe("GET /api/admin/users", () => {
  it("lists only the admin's society, newest first, with filters and pagination", async () => {
    const { app, asAdmin, asOtherAdmin } = await setup();

    const all = await request(app).get("/api/admin/users").set("Cookie", asAdmin);
    expect(all.status).toBe(200);
    expect(all.body.data.map((m: { name: string }) => m.name)).toEqual(["Meera Iyer", "Rohit Sharma", "Asha Rao"]);
    expect(all.body.meta).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
    expect(JSON.stringify(all.body)).not.toMatch(/lakeview/);

    const managers = await request(app).get("/api/admin/users?role=MANAGER").set("Cookie", asAdmin);
    expect(managers.body.data.map((m: { name: string }) => m.name)).toEqual(["Rohit Sharma"]);

    const search = await request(app).get("/api/admin/users?q=MEERA").set("Cookie", asAdmin);
    expect(search.body.data).toHaveLength(1);

    const page2 = await request(app).get("/api/admin/users?page=2&pageSize=2").set("Cookie", asAdmin);
    expect(page2.body.data.map((m: { name: string }) => m.name)).toEqual(["Asha Rao"]);
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });

    const other = await request(app).get("/api/admin/users").set("Cookie", asOtherAdmin);
    expect(other.body.meta.total).toBe(2);
  });

  it("rejects bad query values", async () => {
    const { app, asAdmin } = await setup();

    const res = await request(app).get("/api/admin/users?pageSize=500&status=SLEEPING").set("Cookie", asAdmin);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["pageSize", "status"]);
  });
});

describe("POST /api/admin/users/:id/invite (resend)", () => {
  it("replaces the invite: the old link stops working, the new one works", async () => {
    const { app, store, clock, asAdmin, greenPark, emailSender } = await setup();
    const invited = await addUser(store, { societyId: greenPark.id, status: "INVITED", email: "farhan@example.com" });
    const oldToken = inviteToken(store, invited.id, clock.now);
    clock.advance(60 * 60 * 1000);

    const res = await request(app).post(`/api/admin/users/${invited.id}/invite`).set("Cookie", asAdmin);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ invite: "SENT" });
    expect(res.body.data.inviteExpiresAt).toBe("2026-10-31T11:00:00.000Z");
    const newToken = emailSender.sent[0]?.text.match(/invite\?token=([\w-]+)/)?.[1];
    expect((await request(app).post("/api/auth/invites/lookup").send({ token: oldToken })).status).toBe(410);
    expect((await request(app).post("/api/auth/invites/lookup").send({ token: newToken })).status).toBe(200);
  });

  it("returns 409 USER_NOT_INVITED for an active member", async () => {
    const { app, asAdmin, resident } = await setup();

    const res = await request(app).post(`/api/admin/users/${resident.id}/invite`).set("Cookie", asAdmin);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USER_NOT_INVITED");
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("changes a member's role", async () => {
    const { app, asAdmin, resident } = await setup();

    const res = await request(app).patch(`/api/admin/users/${resident.id}`).set("Cookie", asAdmin).send({ role: "MANAGER" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: resident.id, role: "MANAGER", status: "ACTIVE" });
  });

  it("disabling signs the member out at once; enabling restores ACTIVE, or INVITED without a password", async () => {
    const { app, store, clock, asAdmin, resident, greenPark } = await setup();
    const residentCookie = sessionCookie(store, resident.id, clock.now);
    expect((await request(app).get("/api/auth/me").set("Cookie", residentCookie)).status).toBe(200);

    const disabled = await request(app).patch(`/api/admin/users/${resident.id}`).set("Cookie", asAdmin).send({ disabled: true });
    expect(disabled.body.data.status).toBe("DISABLED");
    expect((await request(app).get("/api/auth/me").set("Cookie", residentCookie)).status).toBe(401);

    const enabled = await request(app).patch(`/api/admin/users/${resident.id}`).set("Cookie", asAdmin).send({ disabled: false });
    expect(enabled.body.data.status).toBe("ACTIVE");

    const invited = await addUser(store, { societyId: greenPark.id, status: "INVITED" });
    inviteToken(store, invited.id, clock.now);
    await request(app).patch(`/api/admin/users/${invited.id}`).set("Cookie", asAdmin).send({ disabled: true });
    expect(store.invites.has(invited.id)).toBe(false);
    const back = await request(app).patch(`/api/admin/users/${invited.id}`).set("Cookie", asAdmin).send({ disabled: false });
    expect(back.body.data.status).toBe("INVITED");
  });

  it("refuses to change the admin themselves or another admin", async () => {
    const { app, store, asAdmin, admin, greenPark } = await setup();
    const coAdmin = await addUser(store, { role: "ADMIN", societyId: greenPark.id });

    const self = await request(app).patch(`/api/admin/users/${admin.id}`).set("Cookie", asAdmin).send({ disabled: true });
    const other = await request(app).patch(`/api/admin/users/${coAdmin.id}`).set("Cookie", asAdmin).send({ role: "RESIDENT" });

    expect(self.status).toBe(403);
    expect(other.status).toBe(403);
    expect(admin.status).toBe("ACTIVE");
  });

  it("validates the id and the body", async () => {
    const { app, asAdmin, resident } = await setup();

    const badId = await request(app).patch("/api/admin/users/not-a-uuid").set("Cookie", asAdmin).send({ disabled: true });
    const empty = await request(app).patch(`/api/admin/users/${resident.id}`).set("Cookie", asAdmin).send({});

    expect(badId.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});

describe("tenant isolation", () => {
  it("treats another society's member as not found for every action", async () => {
    const { app, asAdmin, otherResident } = await setup();

    const resend = await request(app).post(`/api/admin/users/${otherResident.id}/invite`).set("Cookie", asAdmin);
    const update = await request(app).patch(`/api/admin/users/${otherResident.id}`).set("Cookie", asAdmin).send({ disabled: true });

    expect(resend.status).toBe(404);
    expect(update.status).toBe(404);
    expect(update.body.error.code).toBe("NOT_FOUND");
    expect(otherResident.status).toBe("ACTIVE");
  });
});
