import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, importSPKI, jwtVerify } from "jose";
import { env } from "../config/env.js";

export interface PrivyClaims {
  /** Privy DID (the JWT `sub`), our user identifier. */
  privyId: string;
}

/** What jose's jwtVerify accepts as the key: a key, raw secret, or a JWKS resolver. */
export type VerifyKey =
  | Awaited<ReturnType<typeof importSPKI>>
  | ReturnType<typeof createRemoteJWKSet>
  | Uint8Array;

export interface VerifyOptions {
  key: VerifyKey;
  appId: string;
  issuer?: string;
}

/** Verify a Privy access token (ES256) and extract its claims. Throws on failure. */
export async function verifyPrivyToken(
  token: string,
  opts: VerifyOptions,
): Promise<PrivyClaims> {
  const options = { issuer: opts.issuer ?? "privy.io", audience: opts.appId };
  // narrow: a JWKS resolver (function) vs a concrete key — distinct jose overloads
  const { payload } =
    typeof opts.key === "function"
      ? await jwtVerify(token, opts.key, options)
      : await jwtVerify(token, opts.key, options);
  if (!payload.sub) throw new Error("token missing sub");
  return { privyId: payload.sub };
}

/** Pull the bearer token out of an Authorization header. */
export function bearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme !== "Bearer" || !value) return null;
  return value;
}

export type AuthVars = { Variables: { privyId: string } };

/**
 * Auth middleware factory. `verify` maps a raw token → claims (or throws).
 * Injectable so tests don't need real Privy keys.
 */
export function makeAuthMiddleware(
  verify: (token: string) => Promise<PrivyClaims>,
) {
  return createMiddleware<AuthVars>(async (c, next) => {
    const token = bearerToken(c.req.header("authorization"));
    if (!token) return c.json({ error: "missing bearer token" }, 401);
    try {
      const claims = await verify(token);
      c.set("privyId", claims.privyId);
    } catch {
      return c.json({ error: "invalid token" }, 401);
    }
    await next();
  });
}

let cachedKey: VerifyKey | undefined;
/**
 * Resolve the Privy verification key. Prefers an explicit SPKI PEM
 * (PRIVY_VERIFICATION_KEY); otherwise uses Privy's JWKS endpoint for the app id
 * (no secret needed — token signatures verify against Privy's public keys).
 */
async function verificationKey(): Promise<VerifyKey> {
  if (cachedKey) return cachedKey;
  if (env.PRIVY_VERIFICATION_KEY) {
    return (cachedKey = await importSPKI(env.PRIVY_VERIFICATION_KEY, "ES256"));
  }
  if (env.PRIVY_APP_ID) {
    return (cachedKey = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/jwks.json`),
    ));
  }
  throw new Error("Privy auth not configured (set PRIVY_APP_ID or PRIVY_VERIFICATION_KEY)");
}

/** Default middleware: verifies against the configured Privy app key. */
export const requireAuth = makeAuthMiddleware(async (token) =>
  verifyPrivyToken(token, {
    key: await verificationKey(),
    appId: env.PRIVY_APP_ID,
    issuer: env.PRIVY_JWT_ISSUER,
  }),
);
