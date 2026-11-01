/**
 * Fills the development database with a demo admin (in no society), a demo society, its members and
 * ten reports (docs/DATABASE.md §7).
 *
 *   npm run db:seed -w backend
 *
 * Every demo account uses SEED_PASSWORD from apps/backend/.env. Refuses to run when NODE_ENV=production.
 * Safe to run twice: it stops if the demo admin already exists.
 */
import { existsSync } from "node:fs";
import { ConfigError, loadConfig } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { SEED_USERS, seedDemoData } from "../src/db/seed.js";
import { createPasswordHasher } from "../src/lib/password.js";
import { PASSWORD_MIN_LENGTH } from "../src/modules/auth/auth.constants.js";

class SeedError extends Error {}

async function main(): Promise<number> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const config = loadConfig();
  if (config.nodeEnv === "production") throw new SeedError("NODE_ENV is production; demo data is for development only.");

  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new SeedError(`Set SEED_PASSWORD in apps/backend/.env (at least ${PASSWORD_MIN_LENGTH} characters).`);
  }

  const { db, pool } = createDatabase(config.databaseUrl);
  try {
    const result = await seedDemoData(db, { passwordHash: await createPasswordHasher().hash(password), now: new Date() });
    if (!result.created) {
      console.log("Demo data is already in the database; nothing changed.");
      return 0;
    }
    console.log(`Created ${result.users} demo accounts and ${result.reports} reports. The admin runs societies from outside them.`);
    console.log("Sign in with any of these emails and SEED_PASSWORD:");
    for (const user of SEED_USERS) console.log(`  ${user.role.padEnd(8)} ${user.email}`);
    return 0;
  } finally {
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof SeedError || error instanceof ConfigError ? error.message : error instanceof Error ? error.message : String(error);
    console.error(`Could not seed the database:\n${message}`);
    process.exit(1);
  });
