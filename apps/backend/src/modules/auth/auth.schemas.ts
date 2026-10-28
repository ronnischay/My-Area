import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./auth.constants.js";

/** Trimmed + lower-cased. Login only checks length; invites validate the format (users.schemas.ts). */
export const EmailInput = z.string().trim().toLowerCase().min(1, "Enter your email").max(255, "Email is too long");

export const NewPasswordInput = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

// The token travels in the body (never the URL) so it can't end up in request logs.
const TokenInput = z.string().min(1, "Invite token is missing").max(200);

export const LoginBodySchema = z.object({
  email: EmailInput,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});

export const InviteLookupBodySchema = z.object({ token: TokenInput });

export const InviteAcceptBodySchema = z.object({ token: TokenInput, password: NewPasswordInput });
