import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertSociety, insertUser, testDatabaseUrl, useTestDatabase } from "../../../test/helpers/db.js";
import { sessions, societies, userInvites, users } from "../../db/schema/index.js";
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
    const admin = await insertUser(db, { email: "asha@greenpark.example", role: "ADMIN", societyId: greenPark.id, name: "Asha Rao" });
    const otherResident = await insertUser(db, { email: "neha@lakeview.example", role: "RESIDENT", societyId: lakeView.id });
    return { greenPark, lakeView, admin, otherResident };
  }

  const invite = (repo: ReturnType<typeof createUsersRepository>, societyId: string, adminId: string, email: string, name = "Member", token = "i") =>
    repo.createInvitedMember({ societyId, invitedById: adminId, name, email, role: "RESIDENT", invite: { tokenHash: hash(token), expiresAt: later } });

  it("creates an invited member and rejects a second account for the same email", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin } = await twoSocieties();

    const member = await invite(repo, greenPark.id, admin.id, "priya@example.com", "Priya Menon");
    expect(member).toMatchObject({ name: "Priya Menon", status: "INVITED", hasPassword: false, inviteExpiresAt: later });

    expect(await invite(repo, greenPark.id, admin.id, "neha@lakeview.example", "Neha", "j")).toBe("EMAIL_TAKEN");
    expect(await repo.createAdmin({ email: "priya@example.com", name: "P", passwordHash: "scrypt$x" })).toBe("EMAIL_TAKEN");
    // The failed insert left nothing behind.
    expect(await db.select().from(userInvites)).toHaveLength(1);
  });

  it("lists only one society, with filters, literal search and correct totals", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin } = await twoSocieties();
    await invite(repo, greenPark.id, admin.id, "priya@example.com", "Priya 50% Menon", "a");
    await invite(repo, greenPark.id, admin.id, "farhan@example.com", "Farhan Qureshi", "b");

    const all = await repo.list(greenPark.id, { page: 1, pageSize: 20 });
    expect(all.total).toBe(3);
    expect(all.items.map((m) => m.email)).not.toContain("neha@lakeview.example");

    expect((await repo.list(greenPark.id, { status: "INVITED", page: 1, pageSize: 20 })).total).toBe(2);
    expect((await repo.list(greenPark.id, { q: "50%", page: 1, pageSize: 20 })).items.map((m) => m.name)).toEqual(["Priya 50% Menon"]);
    expect((await repo.list(greenPark.id, { q: "%", page: 1, pageSize: 20 })).total).toBe(1);

    const page2 = await repo.list(greenPark.id, { page: 2, pageSize: 2 });
    expect(page2).toMatchObject({ total: 3 });
    expect(page2.items).toHaveLength(1);
  });

  it("scopes find/update by society and disabling removes sessions and invite", async () => {
    const repo = createUsersRepository(db);
    const { greenPark, admin, otherResident } = await twoSocieties();
    const member = await invite(repo, greenPark.id, admin.id, "farhan@example.com");
    if (member === "EMAIL_TAKEN") throw new Error("unexpected");

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
    if (member === "EMAIL_TAKEN") throw new Error("unexpected");

    await repo.replaceInvite(member.id, { tokenHash: hash("n"), expiresAt: later });

    expect(await db.select({ tokenHash: userInvites.tokenHash }).from(userInvites)).toEqual([{ tokenHash: hash("n") }]);
  });

  it("creates at most one society per admin, even with concurrent requests", async () => {
    const repo = createSocietiesRepository(db);
    const admin = await insertUser(db, { email: "asha@example.com", role: "ADMIN", societyId: null });
    const input = { name: "Green Park Residency", addressText: "Plot 12, Sector 45, Gurugram" };

    const results = await Promise.all([repo.createForAdmin(admin.id, input), repo.createForAdmin(admin.id, input)]);

    expect(results.filter((r) => r === "ALREADY_EXISTS")).toHaveLength(1);
    expect(await db.select().from(societies)).toHaveLength(1);
    const [row] = await db.select({ societyId: users.societyId }).from(users).where(eq(users.id, admin.id));
    const created = results.find((r) => r !== "ALREADY_EXISTS");
    expect(row?.societyId).toBe(typeof created === "object" ? created.id : undefined);
  });
});
