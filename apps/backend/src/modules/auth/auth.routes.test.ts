import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/helpers/app.js";
import { addSociety, addUser, inviteToken, sessionCookie, TEST_PASSWORD } from "../../../test/helpers/factories.js";
import { hashToken } from "../../lib/tokens.js";
import { LOGIN_MAX_FAILURES, SESSION_COOKIE } from "./auth.constants.js";

function sessionFrom(res: request.Response): string | undefined {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

describe("POST /api/auth/login", () => {
  it("signs in an active user, sets a hardened session cookie and returns the current user", async () => {
    const { app, store } = createTestApp();
    const society = addSociety(store);
    const user = await addUser(store, { email: "meera.iyer@gmail.com", societyId: society.id });

    const res = await request(app).post("/api/auth/login").send({ email: "  Meera.Iyer@Gmail.com ", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toEqual({
      id: user.id,
      name: "Meera Iyer",
      email: "meera.iyer@gmail.com",
      role: "RESIDENT",
      society: { id: society.id, name: society.name, addressText: society.addressText, createdAt: society.createdAt.toISOString() },
    });
    const cookie = sessionFrom(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).not.toMatch(/Secure/);
    expect(store.sessions.size).toBe(1);
    // Only the hash is stored, never the cookie value.
    const token = cookie?.split(";")[0]?.split("=")[1] ?? "";
    expect(store.sessions.has(hashToken(token))).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash/);
  });

  it("marks the cookie Secure in production", async () => {
    const { app, store } = createTestApp({ nodeEnv: "production" });
    await addUser(store, { email: "admin@example.com", role: "ADMIN" });

    const res = await request(app).post("/api/auth/login").send({ email: "admin@example.com", password: TEST_PASSWORD });

    expect(sessionFrom(res)).toMatch(/Secure/);
  });

  it.each([
    ["unknown email", "nobody@example.com", TEST_PASSWORD],
    ["wrong password", "meera@example.com", "wrong password!"],
    ["invited, not accepted", "invited@example.com", TEST_PASSWORD],
    ["disabled account", "disabled@example.com", TEST_PASSWORD],
  ])("gives the same 401 INVALID_CREDENTIALS for %s", async (_case, email, password) => {
    const { app, store } = createTestApp();
    const society = addSociety(store);
    await addUser(store, { email: "meera@example.com", societyId: society.id });
    await addUser(store, { email: "invited@example.com", societyId: society.id, status: "INVITED" });
    await addUser(store, { email: "disabled@example.com", societyId: society.id, status: "DISABLED" });

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    expect(sessionFrom(res)).toBeUndefined();
    expect(store.sessions.size).toBe(0);
  });

  it("rejects a missing email or password with field errors", async () => {
    const { app } = createTestApp();

    const res = await request(app).post("/api/auth/login").send({ email: " ", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toMatchObject({
      email: ["Enter your email"],
      password: ["Enter your password"],
    });
  });

  it(`blocks with 429 and Retry-After after ${LOGIN_MAX_FAILURES} failures, even with the right password`, async () => {
    const { app, store, clock } = createTestApp();
    await addUser(store, { email: "meera@example.com", role: "ADMIN" });

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await request(app).post("/api/auth/login").send({ email: "meera@example.com", password: "wrong password!" });
    }
    const blocked = await request(app).post("/api/auth/login").send({ email: "meera@example.com", password: TEST_PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBe("900");

    clock.advance(15 * 60 * 1000);
    const later = await request(app).post("/api/auth/login").send({ email: "meera@example.com", password: TEST_PASSWORD });
    expect(later.status).toBe(200);
  });
});

describe("GET /api/auth/me and POST /api/auth/logout", () => {
  it("returns the user for a valid session, and 401 after logout", async () => {
    const { app, store, clock } = createTestApp();
    const admin = await addUser(store, { role: "ADMIN", email: "asha@example.com", name: "Asha Rao" });
    const cookie = sessionCookie(store, admin.id, clock.now);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: admin.id, role: "ADMIN", society: null });

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);
    expect(sessionFrom(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(store.sessions.size).toBe(0);

    const after = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 without a cookie, with an unknown token, after expiry, and for a disabled user", async () => {
    const { app, store, clock } = createTestApp();
    const user = await addUser(store, { role: "ADMIN" });
    const cookie = sessionCookie(store, user.id, clock.now);

    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", `${SESSION_COOKIE}=forged`)).status).toBe(401);

    user.status = "DISABLED";
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);

    user.status = "ACTIVE";
    clock.advance(7 * 24 * 60 * 60 * 1000);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });

  it("logout without a session still succeeds", async () => {
    const { app } = createTestApp();
    expect((await request(app).post("/api/auth/logout")).status).toBe(204);
  });
});

describe("invites", () => {
  async function setup() {
    const ctx = createTestApp();
    const society = addSociety(ctx.store, { name: "Green Park Residency" });
    const admin = await addUser(ctx.store, { role: "ADMIN", societyId: society.id });
    const invitee = await addUser(ctx.store, {
      email: "farhan.q@yahoo.com",
      name: "Farhan Qureshi",
      societyId: society.id,
      status: "INVITED",
      invitedById: admin.id,
    });
    const token = inviteToken(ctx.store, invitee.id, ctx.clock.now);
    return { ...ctx, society, invitee, token };
  }

  it("looks up a valid invite without exposing ids or tokens", async () => {
    const { app, token } = await setup();

    const res = await request(app).post("/api/auth/invites/lookup").send({ token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      name: "Farhan Qureshi",
      email: "farhan.q@yahoo.com",
      role: "RESIDENT",
      societyName: "Green Park Residency",
      expiresAt: "2026-10-31T10:00:00.000Z",
    });
  });

  it("accepts an invite: sets the password, activates the user, deletes the invite and signs in", async () => {
    const { app, store, invitee, token } = await setup();

    const res = await request(app).post("/api/auth/invites/accept").send({ token, password: "a long new password" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: invitee.id, role: "RESIDENT", society: { name: "Green Park Residency" } });
    expect(sessionFrom(res)).toMatch(/HttpOnly/);
    expect(invitee.status).toBe("ACTIVE");
    expect(invitee.passwordHash).toMatch(/^scrypt\$/);
    expect(store.invites.has(invitee.id)).toBe(false);

    const login = await request(app).post("/api/auth/login").send({ email: "farhan.q@yahoo.com", password: "a long new password" });
    expect(login.status).toBe(200);
  });

  it("rejects reuse, expiry and unknown tokens with the same 410 INVITE_INVALID", async () => {
    const { app, token } = await setup();

    const unknown = await request(app).post("/api/auth/invites/lookup").send({ token: "not-a-real-token" });
    expect(unknown.status).toBe(410);
    expect(unknown.body.error.code).toBe("INVITE_INVALID");

    await request(app).post("/api/auth/invites/accept").send({ token, password: "a long new password" });
    const reused = await request(app).post("/api/auth/invites/accept").send({ token, password: "another password!" });
    expect(reused.status).toBe(410);

    const second = await setup();
    second.clock.advance(72 * 60 * 60 * 1000);
    const expired = await request(second.app).post("/api/auth/invites/lookup").send({ token: second.token });
    expect(expired.status).toBe(410);
  });

  it("enforces the password rules", async () => {
    const { app, invitee, token } = await setup();

    const short = await request(app).post("/api/auth/invites/accept").send({ token, password: "short" });
    expect(short.status).toBe(400);
    expect(short.body.error.details.fieldErrors.password).toEqual(["Password must be at least 10 characters"]);

    const sameAsEmail = await request(app).post("/api/auth/invites/accept").send({ token, password: "Farhan.Q@yahoo.com" });
    expect(sameAsEmail.status).toBe(400);
    expect(sameAsEmail.body.error.details.fieldErrors.password).toEqual(["Password can't be the same as your email"]);
    expect(invitee.status).toBe("INVITED");
  });
});
