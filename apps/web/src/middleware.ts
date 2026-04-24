import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Any path that ends with /cuenta (optionally followed by more segments) is protected.
// The leading `(.*/)?` allows the match to fire whether or not a locale prefix is present.
const isProtectedRoute = createRouteMatcher(["/(.*/)?cuenta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
