import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getCountryFromRequest } from "@/lib/geo";

const intlMiddleware = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher(["/(.*/)?cuenta(.*)"]);

const COUNTRY_COOKIE = "country";
const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const isApiRoute = (pathname: string) => pathname.startsWith("/api/");

export default clerkMiddleware(async (auth, req) => {
  // Skip intl routing for API routes — they don't use locale prefixes.
  if (isApiRoute(req.nextUrl.pathname)) {
    if (isProtectedRoute(req)) await auth.protect();
    return;
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  const response = intlMiddleware(req);

  // First-visit geo cookie. Existing cookie is never overwritten by middleware;
  // user explicit choices via selector / modal write directly client-side.
  if (!req.cookies.get(COUNTRY_COOKIE)) {
    const detected = getCountryFromRequest(req);
    response.cookies.set(COUNTRY_COOKIE, (detected ?? "unknown").toLowerCase(), {
      maxAge: COUNTRY_COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
