import { cookies } from "next/headers";
import { readApiResponse, networkError } from "@/lib/api-client";
import { apiBaseUrl } from "@/lib/config";

/**
 * Server Component → Express GET, forwarding the visitor's session cookie. Request-time only
 * (reads cookies), so callers must sit behind <Suspense>. Never cached: every response is personal.
 */
export async function backendGet<T>(path: `/api/${string}`): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Accept: "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      cache: "no-store",
    });
  } catch {
    throw networkError();
  }
  return readApiResponse<T>(response);
}
