import { z } from "zod";
import { PaginationQuerySchema } from "../../lib/pagination.js";
import { MEMBER_ROLES, USER_ROLES, USER_STATUSES } from "./users.types.js";

export const MemberName = z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name must be at most 120 characters");

/** Trimmed, lower-cased, valid format: one account per email across the app. */
export const MemberEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

export const InviteMemberBodySchema = z.object({
  name: MemberName,
  email: MemberEmail,
  role: z.enum(MEMBER_ROLES, "Choose Resident or Manager"),
});

export const ListMembersQuerySchema = PaginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z
    .string()
    .trim()
    .max(100, "Search is too long")
    .optional()
    .transform((q) => q || undefined),
});

export const UpdateMemberBodySchema = z
  .object({
    role: z.enum(MEMBER_ROLES, "Choose Resident or Manager").optional(),
    disabled: z.boolean().optional(),
  })
  .refine((body) => body.role !== undefined || body.disabled !== undefined, "Change the role or the disabled state");
