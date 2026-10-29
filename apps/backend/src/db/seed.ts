import { eq } from "drizzle-orm";
import type { ReportCategory, ReportStatus } from "../modules/reports/reports.types.js";
import type { UserRole } from "../modules/users/users.types.js";
import type { Database } from "./client.js";
import { reports, societies, users } from "./schema/index.js";

/** Demo data for local development (docs/DATABASE.md §7). Never run against production. */

const SOCIETY = { name: "Green Park Residency", addressText: "Plot 12, Sector 45, Gurugram" };

export const SEED_USERS = [
  { key: "asha", email: "asha.rao@greenpark.example", name: "Asha Rao", role: "ADMIN" },
  { key: "rohit", email: "rohit.sharma@greenpark.example", name: "Rohit Sharma", role: "MANAGER" },
  { key: "meera", email: "meera.iyer@greenpark.example", name: "Meera Iyer", role: "RESIDENT" },
  { key: "farhan", email: "farhan.qureshi@greenpark.example", name: "Farhan Qureshi", role: "RESIDENT" },
] as const satisfies readonly { key: string; email: string; name: string; role: UserRole }[];

type SeedUserKey = (typeof SEED_USERS)[number]["key"];

interface SeedReport {
  by: SeedUserKey;
  daysAgo: number;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  /** Days after creation that a RESOLVED report was resolved. */
  resolvedAfterDays?: number;
}

const SEED_REPORTS: SeedReport[] = [
  {
    by: "meera",
    daysAgo: 21,
    title: "Streetlight out opposite Block C gate",
    description: "The pole light facing the Block C gate has been off for a week. The path to the parking is completely dark after 7 pm.",
    category: "STREETLIGHTS",
    locationText: "Block C main gate",
    status: "RESOLVED",
    resolvedAfterDays: 3,
  },
  {
    by: "farhan",
    daysAgo: 18,
    title: "Garbage not collected behind Block A",
    description: "The bins behind Block A were not emptied on Monday or Thursday. Stray dogs are tearing the bags open.",
    category: "WASTE",
    locationText: "Bin area behind Block A",
    status: "RESOLVED",
    resolvedAfterDays: 2,
  },
  {
    by: "meera",
    daysAgo: 15,
    title: "Loud music from the clubhouse after 11 pm",
    description: "Parties in the clubhouse hall are playing loud music well past 11 pm on weekdays. Please enforce the quiet hours.",
    category: "NOISE",
    locationText: "Clubhouse party hall",
    status: "REJECTED",
  },
  {
    by: "farhan",
    daysAgo: 12,
    title: "Deep pothole at the Gate 2 speed breaker",
    description: "A pothole has formed right before the Gate 2 speed breaker. Two-wheelers are swerving into oncoming cars to avoid it.",
    category: "ROADS",
    locationText: "Gate 2, inside the speed breaker",
    status: "IN_PROGRESS",
  },
  {
    by: "meera",
    daysAgo: 9,
    title: "Water leaking from the basement ceiling",
    description: "Water drips from the ceiling near parking slot B-14 and a puddle forms on the floor. It gets worse after the tanks are filled.",
    category: "WATER_DRAINAGE",
    locationText: "Basement parking, slot B-14",
    status: "IN_PROGRESS",
  },
  {
    by: "farhan",
    daysAgo: 7,
    title: "Broken swing chain in the children's park",
    description: "One chain on the second swing has snapped and the seat hangs at an angle. Children are still trying to use it.",
    category: "PARKS",
    locationText: "Children's park near Block D",
    status: "IN_PROGRESS",
  },
  {
    by: "meera",
    daysAgo: 5,
    title: "Side gate left unlocked at night",
    description: "The pedestrian side gate near Block E has been left unlocked overnight three times this week. There is no guard posted there.",
    category: "SAFETY",
    locationText: "Pedestrian gate near Block E",
    status: "OPEN",
  },
  {
    by: "farhan",
    daysAgo: 3,
    title: "Storm drain blocked near the main road",
    description: "The drain cover near the main entrance is choked with leaves and plastic. Rainwater floods the entrance after every shower.",
    category: "WATER_DRAINAGE",
    locationText: "Main entrance, near the security cabin",
    status: "OPEN",
  },
  {
    by: "meera",
    daysAgo: 2,
    title: "Flickering lights in the Block B stairwell",
    description: "The tube lights between floors 3 and 5 in the Block B stairwell flicker constantly. It is hard to see the steps at night.",
    category: "STREETLIGHTS",
    locationText: "Block B stairwell, floors 3 to 5",
    status: "OPEN",
  },
  {
    by: "farhan",
    daysAgo: 1,
    title: "Fallen branch blocking the jogging track",
    description: "A large branch came down in last night's wind and is lying across the jogging track near the pond.",
    category: "PARKS",
    locationText: "Jogging track beside the pond",
    status: "OPEN",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type SeedResult = { created: false } | { created: true; users: number; reports: number };

/**
 * Creates the demo society, its four members (ACTIVE, all with `passwordHash`) and ten reports in one
 * transaction. Does nothing when the demo admin already exists, so it is safe to run twice.
 */
export async function seedDemoData(db: Database, { passwordHash, now }: { passwordHash: string; now: Date }): Promise<SeedResult> {
  const [admin] = SEED_USERS;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, admin.email)).limit(1);
  if (existing.length > 0) return { created: false };

  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);

  return db.transaction(async (tx) => {
    const [society] = await tx.insert(societies).values(SOCIETY).returning({ id: societies.id });
    if (!society) throw new Error("society insert returned no row");

    const ids = {} as Record<SeedUserKey, string>;
    for (const user of SEED_USERS) {
      const [row] = await tx
        .insert(users)
        .values({ societyId: society.id, email: user.email, name: user.name, role: user.role, status: "ACTIVE", passwordHash })
        .returning({ id: users.id });
      if (!row) throw new Error("user insert returned no row");
      ids[user.key] = row.id;
    }

    await tx.insert(reports).values(
      SEED_REPORTS.map(({ by, daysAgo, resolvedAfterDays, ...report }) => ({
        ...report,
        societyId: society.id,
        createdById: ids[by],
        resolvedAt: report.status === "RESOLVED" ? ago(daysAgo - (resolvedAfterDays ?? 1)) : null,
        createdAt: ago(daysAgo),
        updatedAt: ago(report.status === "OPEN" ? daysAgo : Math.max(daysAgo - (resolvedAfterDays ?? 1), 0)),
      })),
    );

    return { created: true, users: SEED_USERS.length, reports: SEED_REPORTS.length };
  });
}
