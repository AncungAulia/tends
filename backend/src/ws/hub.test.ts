import { test } from "node:test";
import assert from "node:assert/strict";
import { WsHub, type WsClient } from "./hub.js";

function fakeClient() {
  const received: string[] = [];
  const client: WsClient = { send: (d) => void received.push(d) };
  return { client, received };
}

test("broadcast delivers JSON to all clients", () => {
  const hub = new WsHub();
  const a = fakeClient();
  const b = fakeClient();
  hub.add(a.client);
  hub.add(b.client);
  hub.broadcast({ type: "rebalanced", vault: "0x1" });
  const expected = JSON.stringify({ type: "rebalanced", vault: "0x1" });
  assert.deepEqual(a.received, [expected]);
  assert.deepEqual(b.received, [expected]);
});

test("removed clients stop receiving; size tracks connections", () => {
  const hub = new WsHub();
  const a = fakeClient();
  hub.add(a.client);
  assert.equal(hub.size, 1);
  hub.remove(a.client);
  assert.equal(hub.size, 0);
  hub.broadcast({ type: "x" });
  assert.equal(a.received.length, 0);
});

test("a throwing client is dropped and does not break others", () => {
  const hub = new WsHub();
  const bad: WsClient = { send: () => { throw new Error("closed"); } };
  const good = fakeClient();
  hub.add(bad);
  hub.add(good.client);
  hub.broadcast({ type: "ping" });
  assert.equal(good.received.length, 1); // good still got it
  assert.equal(hub.size, 1); // bad was dropped
});
