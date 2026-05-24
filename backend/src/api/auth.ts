import { createMiddleware } from "hono/factory";
import { importSPKI, jwtVerify, type CryptoKey } from "jose";
import { env } from "../config/env.js";

export interface PrivyClaims {
  /** Privy DID (the JWT `sub`), our user identifier. */
  privyId: string;
}

export interface VerifyOptions {
  key: CryptoKey | Uint8Array;
  appId: string;
  issuer?: string;
}

/** Verify a Privy access token (ES256) and extract its claims. Throws on failure. */
export async function verifyPrivyToken(
  token: string,
  opts: VerifyOptions,
): Promise<PrivyClaims> {
  const { payload } = await jwtVerify(token, opts.key, {
    issuer: opts.issuer ?? "privy.io",
    audience: opts.appId,
  });
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

let cachedKey: CryptoKey | undefined;
async function verificationKey(): Promise<CryptoKey> {
  if (!env.PRIVY_VERIFICATION_KEY) throw new Error("PRIVY_VERIFICATION_KEY not set");
  cachedKey ??= await importSPKI(env.PRIVY_VERIFICATION_KEY, "ES256");
  return cachedKey;
}

/** Default middleware: verifies against the configured Privy app key. */
export const requireAuth = makeAuthMiddleware(async (token) =>
  verifyPrivyToken(token, {
    key: await verificationKey(),
    appId: env.PRIVY_APP_ID,
    issuer: env.PRIVY_JWT_ISSUER,
  }),
);
