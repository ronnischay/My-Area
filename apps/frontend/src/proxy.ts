import { type NextRequest, NextResponse } from "next/server";

/** Pages anyone can open. Everything else needs a session. */
const PUBLIC_PATHS = ["/login", "/invite", "/forgot-password", "/reset-password"];

/**
 * Optimistic check only (docs: "Optimistic checks with Proxy"): no session cookie → /login. Whether the
 * cookie is still valid is decided by the API, through `requireUser()` in each page.
 * `/api` is excluded from the matcher, so uploads stream straight to the rewrite without being buffered here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (request.cookies.has("myarea_session")) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
