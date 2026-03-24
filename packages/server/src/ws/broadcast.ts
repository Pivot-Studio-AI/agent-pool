/**
 * Broadcast layer for pushing events to WebSocket clients.
 *
 * The real WebSocket server (ws/server.ts) will call setBroadcastFn()
 * to inject the actual send logic once the WS server is initialized.
 * Until then, broadcast() is a safe no-op so services can call it
 * freely during startup, testing, and migration.
 */

export interface BroadcastMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

type BroadcastFn = (channel: string, message: BroadcastMessage) => void;

let _broadcastFn: BroadcastFn | null = null;

/**
 * Inject the real broadcast implementation once the WS server is ready.
 */
export function setBroadcastFn(fn: BroadcastFn): void {
  _broadcastFn = fn;
}

/**
 * Broadcast a message to all clients subscribed to the given channel.
 * No-op if no broadcast function has been injected yet.
 */
export function broadcast(channel: string, type: string, data: unknown): void {
  if (!_broadcastFn) return;

  const message: BroadcastMessage = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  _broadcastFn(channel, message);
}
