import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { sessions, userInvites, users } from "../../db/schema/index.js";
import { createUsersRepository } from "../users/users.repository.js";
import { createAuthRepository } from "./auth.repository.js";

const now = new Date("2026-10-28T10:00:00.000Z");
const hours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
const hash = (c: string) => c.repeat(64);

describe.skipIf(!testDatabaseUrl)("auth repository (PostgreSQL)", () => {
  const db = useTestDatabase();

  it("starts a session, finds its user while unexpired, and clears the user's expired sessions on next login", async () => {
    const repo = createAuthRepository(db);
    const society = await insertSociety(db);
    const user = await insertUser(db, { email: "meera@example.com", role: "RESIDENT", societyId: society.id });

    await repo.startSession({ userId: user.id, session: { tokenHash: hash("a"), expiresAt: hours(1) }, now });
    expect(await repo.findSessionUser(hash("a"), now)).toEqual({ userId: user.id, role: "RESIDENT", status: "ACTIVE", societyId: society.id });
    expect(await repo.findSessionUser(hash("a"), hours(2))).toBeNull();

    await repo.startSession({ userId: user.id, session: { tokenHash: hash("b"), expiresAt: hours(10) }, now: hours(2) });
    const remaining = await db.select({ tokenHash: sessions.tokenHash }).from(sessions);
    expect(remaining).toEqual([{ tokenHash: hash("b") }]);
    const [row] = await db.select({ lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, user.id));
    expect(row?.lastLoginAt).toEqual(hours(2));
  });

  it("loads the current user with or without a society", async () => {
    const repo = createAuthRepository(db);
    const society = await insertSociety(db);
    const admin = await insertUser(db, { email: "asha@example.com", role: "ADMIN", societyId: null, name: "Asha Rao" });
    const resident = await insertUser(db, { email: "meera@example.com", role: "RESIDENT", societyId: society.id });

    expect(await repo.findCurrentUser(admin.id)).toEqual({ id: admin.id, name: "Asha Rao", email: "asha@example.com", role: "ADMIN", society: null });
    expect((await repo.findCurrentUser(resident.id))?.society).toEqual({
      id: society.id,
      name: "Green Park Residency",
      addressText: "Plot 12, Sector 45, Gurugram",
      createdAt: society.createdAt,
    });
  });

  it("accepts an invite once: activates the user, deletes the invite, creates a session", async () => {
    const auth = createAuthRepository(db);
    const members = createUsersRepository(db);
    const society = await insertSociety(db);
    const admin = await insertUser(db, { email: "asha@example.com", role: "ADMIN", societyId: null });
    const member = await members.createInvitedMember({
      societyId: society.id,
      invitedById: admin.id,
      name: "Farhan Qureshi",
      email: "farhan@example.com",
      role: "RESIDENT",
      invite: { tokenHash: hash("i"), expiresAt: hours(72) },
    });
    if ("conflict" in member) throw new Error("unexpected");

    expect(await auth.findInvite(hash("i"), hours(73))).toBeNull();
    expect(await auth.findInvite(hash("i"), now)).toMatchObject({ userId: member.id, societyName: "Green Park Residency" });

    const accept = { tokenHash: hash("i"), passwordHash: "scrypt$x", session: { tokenHash: hash("s"), expiresAt: hours(168) }, now };
    expect(await auth.acceptInvite(accept)).toBe(member.id);
    expect(await auth.acceptInvite({ ...accept, session: { tokenHash: hash("t"), expiresAt: hours(168) } })).toBeNull();

    const [user] = await db.select().from(users).where(eq(users.id, member.id));
    expect(user).toMatchObject({ status: "ACTIVE", passwordHash: "scrypt$x" });
    expect(await db.select().from(userInvites)).toHaveLength(0);
    expect(await auth.findSessionUser(hash("s"), now)).toMatchObject({ userId: member.id, status: "ACTIVE" });
  });

  it("enforces the users check constraints and cascades sessions on user delete", async () => {
    const society = await insertSociety(db);

    await expect(insertUser(db, { email: "x@example.com", role: "RESIDENT", societyId: null })).rejects.toThrow();
    await expect(
      insertUser(db, { email: "y@example.com", role: "RESIDENT", societyId: society.id, status: "ACTIVE", passwordHash: null }),
    ).rejects.toThrow();

    const user = await insertUser(db, { email: "z@example.com", role: "RESIDENT", societyId: society.id });
    await createAuthRepository(db).startSession({ userId: user.id, session: { tokenHash: hash("c"), expiresAt: hours(1) }, now });
    await db.delete(users).where(eq(users.id, user.id));
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});
