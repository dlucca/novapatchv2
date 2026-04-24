import { createClerkClient, verifyToken } from "@clerk/backend";

export interface VerifiedToken {
  clerkUserId: string;
}

export interface TokenVerifier {
  /**
   * Verifies a JWT. On success resolves with the Clerk user id (from the `sub` claim).
   * On any failure (expired, malformed, invalid signature, revoked) rejects.
   */
  verify(token: string): Promise<VerifiedToken>;
}

export interface ClerkUser {
  clerkUserId: string;
  email: string;
}

export interface ClerkUserClient {
  /**
   * Fetches the Clerk user's profile and returns the primary email.
   * Throws if the user doesn't exist or has no primary email configured.
   */
  getUser(clerkUserId: string): Promise<ClerkUser>;
}

// ---------- Production implementations ----------

export function createClerkVerifier(opts: { secretKey: string }): TokenVerifier {
  return {
    async verify(token) {
      const payload = await verifyToken(token, { secretKey: opts.secretKey });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new Error("verified token has no `sub` claim");
      }
      return { clerkUserId: payload.sub };
    },
  };
}

export function createClerkUserClient(opts: { secretKey: string }): ClerkUserClient {
  const clerk = createClerkClient({ secretKey: opts.secretKey });
  return {
    async getUser(clerkUserId) {
      const user = await clerk.users.getUser(clerkUserId);
      const primary = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId,
      );
      if (!primary) {
        throw new Error(`Clerk user ${clerkUserId} has no primary email`);
      }
      return { clerkUserId, email: primary.emailAddress };
    },
  };
}

// ---------- Test stubs ----------

/**
 * Map of `token -> payload`. `verify(token)` returns the mapped payload or throws.
 * Used only in tests.
 */
export function createStubVerifier(
  tokens: Record<string, VerifiedToken>,
): TokenVerifier {
  return {
    async verify(token) {
      const payload = tokens[token];
      if (!payload) {
        throw new Error(`invalid token: ${token}`);
      }
      return payload;
    },
  };
}

/**
 * Map of `userId -> user`. `getUser(id)` returns the mapped user or throws.
 * Used only in tests.
 */
export function createStubUserClient(
  users: Record<string, ClerkUser>,
): ClerkUserClient {
  return {
    async getUser(clerkUserId) {
      const user = users[clerkUserId];
      if (!user) {
        throw new Error(`user not found: ${clerkUserId}`);
      }
      return user;
    },
  };
}
