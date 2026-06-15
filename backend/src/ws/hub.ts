import { childLogger } from "../lib/logger.js";

const log = childLogger("ws");

/** Minimal client surface — anything that can receive a string frame. */
export interface WsClient {
  send(data: string): void;
}

export interface WsEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Fan-out hub for the dashboard WebSocket. The indexer broadcasts on-chain events
 * here; connected clients receive them as JSON. A client whose send() throws is
 * dropped (e.g. already closed).
 */
export class WsHub {
  private readonly clients = new Set<WsClient>();

  add(client: WsClient): void {
    this.clients.add(client);
  }

  remove(client: WsClient): void {
    this.clients.delete(client);
  }

  get size(): number {
    return this.clients.size;
  }

  broadcast(event: WsEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      try {
        client.send(data);
      } catch {
        this.clients.delete(client);
      }
    }
    log.debug({ type: event.type, clients: this.clients.size }, "broadcast");
  }
}

export const wsHub = new WsHub();
