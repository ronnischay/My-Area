import { z } from "zod";
import type { PasswordHasher } from "../../lib/password.js";
import { NewPasswordInput } from "../auth/auth.schemas.js";
import type { UsersRepository } from "./users.repository.js";
import { MemberEmail, MemberName } from "./users.schemas.js";

const CreateAdminInputSchema = z.object({ email: MemberEmail, name: MemberName, password: NewPasswordInput });

export class CreateAdminError extends Error {
  override name = "CreateAdminError";
}

/**
 * Core of `npm run user:create-admin` (scripts/create-admin.ts), the only way an ADMIN is created.
 * The admin starts ACTIVE with no society; they create it after signing in.
 */
export async function createAdminAccount(
  deps: { repository: UsersRepository; passwordHasher: PasswordHasher },
  rawInput: { email: unknown; name: unknown; password: unknown },
): Promise<{ id: string; email: string }> {
  const parsed = CreateAdminInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new CreateAdminError(problems.join("\n"));
  }

  const { email, name, password } = parsed.data;
  if (password.trim().toLowerCase() === email) throw new CreateAdminError("password: Password can't be the same as the email");

  const result = await deps.repository.createAdmin({ email, name, passwordHash: await deps.passwordHasher.hash(password) });
  if (result === "EMAIL_TAKEN") throw new CreateAdminError(`email: ${email} already has a MyArea account`);
  return { id: result.id, email };
}
