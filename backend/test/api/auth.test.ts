import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { SignJWT, generateKeyPair, type CryptoKey } from "jose";
import {
  bearerToken,
  verifyPrivyToken,
  makeAuthMiddleware,
  type AuthVars,
} from "../../src/api/auth.js";

test("bearerToken: extracts only well-formed Bearer headers", () => {
  assert.equal(bearerToken("Bearer abc.def"), "abc.def");
  assert.equal(bearerToken(undefined), null);
  assert.equal(bearerToken(""), null);
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer"), null);
});

async function signToken(opts: {
  privateKey: CryptoKey;
  sub?: string;
  aud?: string;
  iss?: string;
  expSec?: number;
}) {
  let jwt = new SignJWT({}).setProtectedHeader({ alg: "ES256" }).setIssuedAt();
  if (opts.sub) jwt = jwt.setSubject(opts.sub);
  jwt = jwt.setIssuer(opts.iss ?? "privy.io").setAudience(opts.aud ?? "app123");
  jwt = jwt.setExpirationTime(opts.expSec ?? Math.floor(Date.now() / 1000) + 3600);
  return jwt.sign(opts.privateKey);
}

test("verifyPrivyToken: accepts a valid token and returns privyId", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const token = await signToken({ privateKey, sub: "did:privy:abc" });
  const claims = await verifyPrivyToken(token, { key: publicKey, appId: "app123" });
  assert.equal(claims.privyId, "did:privy:abc");
});

test("verifyPrivyToken: rejects wrong audience, expiry, and missing sub", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");

  const wrongAud = await signToken({ privateKey, sub: "x", aud: "other" });
  await assert.rejects(() => verifyPrivyToken(wrongAud, { key: publicKey, appId: "app123" }));

  const expired = await signToken({
    privateKey,
    sub: "x",
    expSec: Math.floor(Date.now() / 1000) - 10,
  });
  await assert.rejects(() => verifyPrivyToken(expired, { key: publicKey, appId: "app123" }));

  const noSub = await signToken({ privateKey });
  await assert.rejects(() => verifyPrivyToken(noSub, { key: publicKey, appId: "app123" }));
});

test("verifyPrivyToken: rejects a token signed by a different key", async () => {
  const a = await generateKeyPair("ES256");
  const b = await generateKeyPair("ES256");
  const token = await signToken({ privateKey: a.privateKey, sub: "x" });
  await assert.rejects(() => verifyPrivyToken(token, { key: b.publicKey, appId: "app123" }));
});

function appWithAuth(verify: (t: string) => Promise<{ privyId: string }>) {
  const app = new Hono<AuthVars>();
  app.use("/secure", makeAuthMiddleware(verify));
  app.get("/secure", (c) => c.json({ privyId: c.get("privyId") }));
  return app;
}

test("auth middleware: 401 without a token", async () => {
  const res = await appWithAuth(async () => ({ privyId: "x" })).request("/secure");
  assert.equal(res.status, 401);
});

test("auth middleware: 401 when verify throws", async () => {
  const app = appWithAuth(async () => {
    throw new Error("bad");
  });
  const res = await app.request("/secure", { headers: { authorization: "Bearer t" } });
  assert.equal(res.status, 401);
});

test("auth middleware: 200 + privyId on success", async () => {
  const app = appWithAuth(async () => ({ privyId: "did:privy:ok" }));
  const res = await app.request("/secure", { headers: { authorization: "Bearer t" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { privyId: "did:privy:ok" });
});
