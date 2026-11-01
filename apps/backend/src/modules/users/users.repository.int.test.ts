import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { sessions, userInvites, users } from "../../db/schema/index.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createSocietiesRepository } from "../societies/societies.repository.js";
import { createUsersRepository } from "./users.repository.js";

const now = new Date("2026-10-28T10:00:00.000Z");
const later = new Date("2026-10-31T10:00:00.000Z");
const hash = (c: string) => c.repeat(64);

describe.skipIf(!testDatabaseUrl)("users + societies repositories (PostgreSQL)", () => {
  const db = useTestDatabase();

  async function twoSocieties() {
    const greenPark = await insertSociety(db, "Green Park Residency");
    const lakeView = await insertSociety(db, "Lake View Towers");
    const admin = await insertUser(db, { email: "asha@greenpark.example", role: "ADMIN", societyId: null, name: "Asha Rao" });
    const otherResident = await insertUser(db, { email: "neha@lakeview.example", role: "RESIDENT", societyId: lakeView.id });
    return { greenPark, lakeView, admin, otherResident };
  }

  const invite = (repo: ReturnType<typeof createUsersRepository>, societyId: string, adminId: string, email: string, name = "Member", token = "i") =>
    repo.createInvitedMember({ societyId, invitedById: adminId, name, email, role: "RESIDENT", invite: { tokenHash: hash(token), expiresAt: later } });

  it("creates an invited member; an email with an account says where it is (one society per person)", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, lakeView, admin } = await twoSocieties();

    const member = await invite(repo, greenPark.id, admin.id, "priya@example.com", "Priya Menon");
    expect(member).toMatchObject({ name: "Priya Menon", status: "INVITED", hasPassword: false, inviteExpiresAt: later });

    expect(await invite(repo, greenPark.id, admin.id, "priya@example.com", "Priya", "j")).toEqual({ conflict: "THIS_SOCIETY" });
    expect(await invite(repo, lakeView.id, admin.id, "priya@example.com", "Priya", "k")).toEqual({ conflict: "OTHER_SOCIETY" });
    expect(await invite(repo, greenPark.id, admin.id, "neha@lakeview.example", "Neha", "l")).toEqual({ conflict: "OTHER_SOCIETY" });
    expect(await invite(repo, greenPark.id, admin.id, "asha@greenpark.example", "Asha", "m")).toEqual({ conflict: "ADMIN" });
    expect(await repo.createAdmin({ email: "priya@example.com", name: "P", passwordHash: "scrypt$x" })).toBe("EMAIL_TAKEN");
    // The failed inserts left nothing behind.
    expect(await db.select().from(userInvites)).toHaveLength(1);
    expect(await repo.findInviter(admin.id, lakeView.id)).toEqual({ name: "Asha Rao", societyName: "Lake View Towers" });
  });

  it("lists only one society, with filters, literal search and correct totals", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin } = await twoSocieties();
    await invite(repo, greenPark.id, admin.id, "priya@example.com", "Priya 50% Menon", "a");
    await invite(repo, greenPark.id, admin.id, "farhan@example.com", "Farhan Qureshi", "b");

    const all = await repo.list(greenPark.id, { page: 1, pageSize: 20 });
    expect(all.total).toBe(2);
    expect(all.items.map((m) => m.email)).not.toContain("asha@greenpark.example");
    expect(all.items.map((m) => m.email)).not.toContain("neha@lakeview.example");

    expect((await repo.list(greenPark.id, { status: "INVITED", page: 1, pageSize: 20 })).total).toBe(2);
    expect((await repo.list(greenPark.id, { q: "50%", page: 1, pageSize: 20 })).items.map((m) => m.name)).toEqual(["Priya 50% Menon"]);
    expect((await repo.list(greenPark.id, { q: "%", page: 1, pageSize: 20 })).total).toBe(1);

    const page2 = await repo.list(greenPark.id, { page: 2, pageSize: 1 });
    expect(page2).toMatchObject({ total: 2 });
    expect(page2.items).toHaveLength(1);
  });

  it("scopes find/update by society and disabling removes sessions and invite", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin, otherResident } = await twoSocieties();
    const member = await invite(repo, greenPark.id, admin.id, "farhan@example.com");
    if ("conflict" in member) throw new Error("unexpected");

    expect(await repo.findMember(greenPark.id, otherResident.id)).toBeNull();
    expect(await repo.updateMember(greenPark.id, otherResident.id, { status: "DISABLED" })).toBeNull();
    const [untouched] = await db.select({ status: users.status }).from(users).where(eq(users.id, otherResident.id));
    expect(untouched?.status).toBe("ACTIVE");

    await createAuthRepository(db).startSession({ userId: member.id, session: { tokenHash: hash("s"), expiresAt: later }, now });
    const disabled = await repo.updateMember(greenPark.id, member.id, { status: "DISABLED" });
    expect(disabled).toMatchObject({ status: "DISABLED", inviteExpiresAt: null });
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(await db.select().from(userInvites)).toHaveLength(0);
  });

  it("replaceInvite keeps exactly one invite per user with the new token", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin } = await twoSocieties();
    const member = await invite(repo, greenPark.id, admin.id, "farhan@example.com");
    if ("conflict" in member) throw new Error("unexpected");

    await repo.replaceInvite(member.id, { tokenHash: hash("n"), expiresAt: later });

    expect(await db.select({ tokenHash: userInvites.tokenHash }).from(userInvites)).toEqual([{ tokenHash: hash("n") }]);
  });

  it("societies: create links nobody, list counts managers and residents per society", async () => {
    const repo = createSocietiesRepository(db);
    const { greenPark, admin } = await twoSocieties();
    await invite(createUsersRepository(db), greenPark.id, admin.id, "farhan@example.com");
    await insertUser(db, { email: "rohit@greenpark.example", role: "MANAGER", societyId: greenPark.id });

    const created = await repo.create({ name: "Palm Grove", addressText: "Sector 9, Noida" });

    expect(await repo.findById(created.id)).toMatchObject({ name: "Palm Grove" });
    expect((await repo.list()).map((s) => [s.name, s.managerCount, s.residentCount])).toEqual([
      ["Palm Grove", 0, 0],
      ["Lake View Towers", 0, 1],
      ["Green Park Residency", 1, 1],
    ]);
    const [row] = await db.select({ societyId: users.societyId }).from(users).where(eq(users.id, admin.id));
    expect(row?.societyId).toBeNull();
  });

  it("enforces admins outside societies and everyone else in exactly one (users_society_required_ck)", async () => {
    const { greenPark } = await twoSocieties();
    const code = (p: Promise<unknown>) => p.then(() => "ok", (err) => ((err as { cause?: { code?: string } }).cause ?? (err as { code?: string })).code);

    expect(await code(insertUser(db, { email: "a2@example.com", role: "ADMIN", societyId: greenPark.id }))).toBe("23514");
    expect(await code(insertUser(db, { email: "r2@example.com", role: "RESIDENT", societyId: null }))).toBe("23514");
    expect(await code(insertUser(db, { email: "m2@example.com", role: "MANAGER", societyId: null }))).toBe("23514");
  });
});
