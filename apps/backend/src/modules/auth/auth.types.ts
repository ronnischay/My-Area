import { type Society, type SocietyDto, toSocietyDto } from "../societies/societies.types.js";
import type { UserRole } from "../users/users.types.js";

/** What require-auth attaches to `req.auth`. `societyId` is the tenant boundary for every query. */
export interface AuthContext {
  userId: string;
  role: UserRole;
  societyId: string | null;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  society: Society | null;
}

/** `CurrentUser` in the API contract. */
export interface CurrentUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  society: SocietyDto | null;
}

export interface InviteDetails {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  societyName: string;
  expiresAt: Date;
}

export interface InviteDetailsDto {
  name: string;
  email: string;
  role: UserRole;
  societyName: string;
  expiresAt: string;
}

/** A freshly created session: the raw token goes into the cookie, never into the database. */
export interface SessionGrant {
  user: CurrentUser;
  token: string;
  expiresAt: Date;
}

export function toCurrentUserDto(user: CurrentUser): CurrentUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    society: user.society ? toSocietyDto(user.society) : null,
  };
}

export function toInviteDetailsDto(invite: InviteDetails): InviteDetailsDto {
  return {
    name: invite.name,
    email: invite.email,
    role: invite.role,
    societyName: invite.societyName,
    expiresAt: invite.expiresAt.toISOString(),
  };
}
