import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import type { CurrentUser, DataResponse, Society, UserRole } from "@/types/api";
import { backendGet } from "./backend";

/**
 * Data Access Layer for the signed-in user. The Express API is the only authority (D014); this only
 * asks it who the cookie belongs to. Cached per browser for a short time (`use cache: private`), so
 * several components can call it in one render.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife({ stale: 30 });

  // Reading the cookie here keys the private cache on it, so signing in or out gives a fresh result.
  if (!(await cookies()).has("myarea_session")) return null;
  try {
    const { data } = await backendGet<DataResponse<CurrentUser>>("/api/auth/me");
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** The signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type MemberUser = CurrentUser & { society: Society };

/** A signed-in member of a society. Admins belong to none (D028), so they are sent to their societies. */
export async function requireMember(): Promise<MemberUser> {
  const user = await requireUser();
  if (!user.society) redirect("/admin/societies");
  return { ...user, society: user.society };
}

/** A member with one of `roles`; anyone else is sent home. The API enforces the same rule. */
export async function requireRole(...roles: UserRole[]): Promise<MemberUser> {
  const user = await requireMember();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** A signed-in admin; anyone else is sent home. The API enforces the same rule. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
