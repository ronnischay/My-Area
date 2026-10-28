/** Mirrors docs/API_CONTRACT.md §2 and DATABASE.md §3. Kept free of Drizzle so services can import it. */

export const USER_ROLES = ["ADMIN", "MANAGER", "RESIDENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles an admin can give through the API. ADMIN is only created by the CLI. */
export const MEMBER_ROLES = ["MANAGER", "RESIDENT"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const USER_STATUSES = ["INVITED", "ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  hasPassword: boolean;
  inviteExpiresAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** `SocietyMember` in the API contract. */
export interface SocietyMemberDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export type InviteDelivery = "SENT" | "FAILED";

export function toSocietyMemberDto(member: MemberRecord): SocietyMemberDto {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    inviteExpiresAt: member.status === "INVITED" ? (member.inviteExpiresAt?.toISOString() ?? null) : null,
    lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
  };
}
