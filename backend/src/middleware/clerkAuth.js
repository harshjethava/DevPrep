/**
 * Custom Clerk authentication middleware.
 *
 * Replaces ClerkExpressRequireAuth with a direct call to verifyToken
 * so we can pass clockSkewInMs — ClerkExpressRequireAuth in v4 does
 * not forward that option, which causes new tokens minted on a hard
 * page refresh to fail with 401 for the first 1-3 seconds.
 *
 * The middleware:
 *  1. Extracts the Bearer token from the Authorization header.
 *  2. Verifies it using Clerk's JWKS (cached by default for 5 min).
 *  3. Populates req.auth with the decoded payload.
 *  4. On failure, returns 401.
 */

const { clerkClient } = require('@clerk/clerk-sdk-node');

// Clock skew tolerance: allow tokens whose iat/nbf is up to 60 seconds
// in the future relative to the backend clock.  This covers the window
// between Clerk minting the token and the backend receiving the first
// request on a hard page refresh, especially since this environment's clock
// is ~12 seconds behind Clerk's servers.
const CLOCK_SKEW_MS = 60_000;

function clerkAuthMiddleware() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not set');
  }

  return async function clerkAuth(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const parts = header.split(' ');

      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        console.error('Clerk Auth Error: Missing or invalid Authorization header:', header);
        return res.status(401).json({ error: 'Unauthorized', detail: 'Missing or invalid Authorization header' });
      }

      const tokenPayload = await clerkClient.verifyToken(parts[1], {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: CLOCK_SKEW_MS,
      });

      // Attach the same shape ClerkExpressRequireAuth provides
      req.auth = {
        userId: tokenPayload.sub,
        sessionId: tokenPayload.sid,
        sessionClaims: tokenPayload,
      };

      return next();
    } catch (err) {
      console.error('Clerk Auth Error:', err.message);
      return res.status(401).json({ error: 'Unauthorized', detail: err.message });
    }
  };
}

module.exports = { clerkAuthMiddleware };
