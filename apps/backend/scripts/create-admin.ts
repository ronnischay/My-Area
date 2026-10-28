/**
 * Creates a society admin (docs/DATABASE.md §7).
 *
 *   npm run user:create-admin -w backend -- --email asha@example.com --name "Asha Rao"
 *
 * Asks for the password twice (hidden) when run in a terminal. In CI or other non-interactive runs it
 * reads ADMIN_PASSWORD from the environment instead; never put that in apps/backend/.env.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { ConfigError, loadConfig } from "../src/config/env.js";
import { createDatabase } from "../src/db/client.js";
import { createPasswordHasher } from "../src/lib/password.js";
import { CreateAdminError, createAdminAccount } from "../src/modules/users/create-admin.js";
import { createUsersRepository } from "../src/modules/users/users.repository.js";

/** Reads a line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          reject(new CreateAdminError("cancelled"));
          return;
        }
        value = char === "\u007f" || char === "\b" ? value.slice(0, -1) : value + char;
      }
    };
    stdout.write(question);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const fromEnv = process.env.ADMIN_PASSWORD;
    if (!fromEnv) throw new CreateAdminError("password: not a terminal, so set ADMIN_PASSWORD for this command");
    return fromEnv;
  }
  const password = await promptHidden("Password (at least 10 characters): ");
  const confirm = await promptHidden("Repeat password: ");
  if (password !== confirm) throw new CreateAdminError("password: the two passwords don't match");
  return password;
}

async function main(): Promise<number> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  if (!values.email || !values.name) {
    console.error('Usage: npm run user:create-admin -w backend -- --email <email> --name "<full name>"');
    return 1;
  }

  const config = loadConfig();
  const { db, pool } = createDatabase(config.databaseUrl);
  try {
    const password = await readPassword();
    const admin = await createAdminAccount(
      { repository: createUsersRepository(db), passwordHasher: createPasswordHasher() },
      { email: values.email, name: values.name, password },
    );
    console.log(`Admin created: ${admin.email}. Sign in, then create your society.`);
    return 0;
  } finally {
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof CreateAdminError || error instanceof ConfigError) {
      console.error(`Could not create admin:\n${error.message}`);
    } else {
      console.error("Could not create admin:", error instanceof Error ? error.message : error);
    }
    process.exit(1);
  });
