import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, testConfig } from "../../../test/helpers/app.js";
import { addSociety, addUser, sessionCookie, TEST_PASSWORD } from "../../../test/helpers/factories.js";
import { PASSWORD_RESET_MAX_REQUESTS, PASSWORD_RESET_TTL_MS, SESSION_COOKIE } from "./auth.constants.js";
import { createResetToken, passwordFingerprint } from "./password-reset-token.js";

const NEW_PASSWORD = "a brand new password";

/** Meera (ACTIVE, signed in on two devices), an invited and a disabled member. */
async function setup() {
  const ctx = createTestApp();
  const { store, clock } = ctx;
  const society = addSociety(store);
  const meera = await addUser(store, { societyId: society.id, name: "Meera Iyer", email: "meera@example.com" });
  const phone = sessionCookie(store, meera.id, clock.now);
  const laptop = sessionCookie(store, meera.id, clock.now);
  await addUser(store, { societyId: society.id, status: "INVITED", email: "farhan@example.com" });
  await addUser(store, { societyId: society.id, status: "DISABLED", email: "old@example.com" });
  return { ...ctx, meera, phone, laptop };
}

/** Asks for a reset and returns the token from the email (after the background send). */
async function requestToken(ctx: Awaited<ReturnType<typeof setup>>, email = "meera@example.com") {
  const res = await request(ctx.app).post("/api/auth/password-reset/request").send({ email });
  await ctx.backgroundTasks.idle();
  const token = ctx.emailSender.sent.at(-1)?.text.match(/reset-password\?token=([\w.%-]+)/)?.[1];
  return { res, token: token ? decodeURIComponent(token) : undefined };
}

describe("POST /api/auth/password-reset/request", () => {
  it("emails an active account a one-hour link and answers 202", async () => {
    const ctx = await setup();
    const { res, token } = await requestToken(ctx, "  MEERA@example.com ");

    expect(res.status).toBe(202);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({ data: { requested: true } });
    expect(ctx.emailSender.sent).toHaveLength(1);
    const email = ctx.emailSender.sent[0];
    expect(email?.to).toBe("meera@example.com");
    expect(email?.subject).toBe("Reset your MyArea password");
    expect(email?.text).toContain("Hi Meera Iyer,");
    expect(email?.text).toContain("expires on 28 Oct 2026, 11:00 UTC");
    expect(token).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("answers exactly the same and sends nothing for unknown, invited and disabled emails", async () => {
    const ctx = await setup();
    for (const email of ["nobody@example.com", "farhan@example.com", "old@example.com"]) {
      const { res } = await requestToken(ctx, email);
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ data: { requested: true } });
    }
    expect(ctx.emailSender.sent).toHaveLength(0);
  });

  it(`sends at most ${PASSWORD_RESET_MAX_REQUESTS} emails per address per hour, still answering 202`, async () => {
    const ctx = await setup();
    for (let i = 0; i < PASSWORD_RESET_MAX_REQUESTS + 2; i++) expect((await requestToken(ctx)).res.status).toBe(202);
    expect(ctx.emailSender.sent).toHaveLength(PASSWORD_RESET_MAX_REQUESTS);

    ctx.clock.advance(60 * 60 * 1000);
    await requestToken(ctx);
    expect(ctx.emailSender.sent).toHaveLength(PASSWORD_RESET_MAX_REQUESTS + 1);
  });

  it("logs a failed email without failing the request", async () => {
    const ctx = await setup();
    ctx.emailSender.failWith = new Error("smtp down");
    const { res } = await requestToken(ctx);
    expect(res.status).toBe(202);
    expect(ctx.logger.warn).toHaveBeenCalledWith("password reset email failed", expect.objectContaining({ userId: ctx.meera.id }));
  });

  it("validates the body", async () => {
    const { app } = await setup();
    expect((await request(app).post("/api/auth/password-reset/request").send({})).status).toBe(400);
  });
});

describe("POST /api/auth/password-reset/lookup", () => {
  it("names the account for a valid link", async () => {
    const ctx = await setup();
    const { token } = await requestToken(ctx);

    const res = await request(ctx.app).post("/api/auth/password-reset/lookup").send({ token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { name: "Meera Iyer", email: "meera@example.com" } });
  });

  it("refuses expired, tampered, foreign-secret and unknown-user links with the same 410", async () => {
    const ctx = await setup();
    const { token } = await requestToken(ctx);
    const lookup = (t: string) => request(ctx.app).post("/api/auth/password-reset/lookup").send({ token: t });
    const fingerprint = passwordFingerprint(ctx.meera.passwordHash ?? "");
    const later = new Date(ctx.clock.now.getTime() + PASSWORD_RESET_TTL_MS);

    const tampered = `${token?.split(".")[0]}x.${token?.split(".")[1]}`;
    const otherSecret = createResetToken({ userId: ctx.meera.id, expiresAt: later, fingerprint }, "a-different-secret-0123456789abcdef");
    const ghost = createResetToken({ userId: "7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10", expiresAt: later, fingerprint }, testConfig.passwordResetSecret);

    for (const t of [tampered, otherSecret, ghost, "not-a-token"]) {
      const res = await lookup(t);
      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe("RESET_LINK_INVALID");
    }

    ctx.clock.advance(PASSWORD_RESET_TTL_MS);
    expect((await lookup(token ?? "")).status).toBe(410);
  });

  it("refuses a link once the account is disabled", async () => {
    const ctx = await setup();
    const { token } = await requestToken(ctx);
    ctx.store.users.get(ctx.meera.id)!.status = "DISABLED";
    expect((await request(ctx.app).post("/api/auth/password-reset/lookup").send({ token })).status).toBe(410);
  });
});

describe("POST /api/auth/password-reset/confirm", () => {
  it("sets the password, signs out every other session and signs this browser in", async () => {
    const ctx = await setup();
    const { token } = await requestToken(ctx);
    const me = (cookie: string) => request(ctx.app).get("/api/auth/me").set("Cookie", cookie);
    expect((await me(ctx.phone)).status).toBe(200);

    const res = await request(ctx.app).post("/api/auth/password-reset/confirm").send({ token, password: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: ctx.meera.id, email: "meera@example.com" });
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/);
    // The two old devices are signed out; only the new session remains.
    expect((await me(ctx.phone)).status).toBe(401);
    expect((await me(ctx.laptop)).status).toBe(401);
    expect(ctx.store.sessions.size).toBe(1);
    expect((await me(cookie?.split(";")[0] ?? "")).status).toBe(200);

    const login = (password: string) => request(ctx.app).post("/api/auth/login").send({ email: "meera@example.com", password });
    expect((await login(TEST_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it("works once: the same link, or an older one, fails after a reset", async () => {
    const ctx = await setup();
    const first = (await requestToken(ctx)).token;
    ctx.clock.advance(60_000);
    const second = (await requestToken(ctx)).token;
    expect(second).not.toBe(first);
    const confirm = (token?: string) => request(ctx.app).post("/api/auth/password-reset/confirm").send({ token, password: NEW_PASSWORD });

    expect((await confirm(second)).status).toBe(200);
    expect((await confirm(second)).body.error.code).toBe("RESET_LINK_INVALID");
    expect((await confirm(first)).status).toBe(410);
  });

  it("enforces the password rules and leaves everything unchanged on failure", async () => {
    const ctx = await setup();
    const { token } = await requestToken(ctx);
    const confirm = (password: string) => request(ctx.app).post("/api/auth/password-reset/confirm").send({ token, password });

    const short = await confirm("short");
    expect(short.status).toBe(400);
    expect(short.body.error.details.fieldErrors.password).toEqual(["Password must be at least 10 characters"]);
    const sameAsEmail = await confirm("Meera@Example.com");
    expect(sameAsEmail.body.error.details.fieldErrors.password).toEqual(["Password can't be the same as your email"]);

    expect((await request(ctx.app).get("/api/auth/me").set("Cookie", ctx.phone)).status).toBe(200);
    expect((await confirm(NEW_PASSWORD)).status).toBe(200);
  });
});
