import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { Server as HttpServer } from 'http';
import { setBroadcastFn, type BroadcastMessage } from './broadcast.js';

export const VALID_CHANNELS = ['tasks', 'events', 'slots'] as const;
export type Channel = (typeof VALID_CHANNELS)[number];

/** All connected clients. */
export const clients = new Set<WebSocket>();

/** Channel → set of subscribed clients. */
export const channels = new Map<Channel, Set<WebSocket>>(
  VALID_CHANNELS.map((ch) => [ch, new Set()]),
);

/** Create the WebSocket server in noServer mode. */
export const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
        for (const ch of msg.channels) {
          if (VALID_CHANNELS.includes(ch)) {
            channels.get(ch)!.add(ws);
          }
        }
      } else if (msg.type === 'unsubscribe' && Array.isArray(msg.channels)) {
        for (const ch of msg.channels) {
          if (VALID_CHANNELS.includes(ch)) {
            channels.get(ch)!.delete(ws);
          }
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    for (const subs of channels.values()) {
      subs.delete(ws);
    }
  });

  ws.on('error', () => {
    clients.delete(ws);
    for (const subs of channels.values()) {
      subs.delete(ws);
    }
  });
});

/**
 * Handle an HTTP upgrade request, promoting the connection to WebSocket.
 */
export function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}

/**
 * Attach the upgrade handler to an existing HTTP server.
 * Upgrades on the `/ws` path only.
 */
export { attachWebSocket as setupWebSocket };
export function attachWebSocket(server: HttpServer): void {
  // Wire up the broadcast layer so services can push events to WS clients
  setBroadcastFn((channel: string, message: BroadcastMessage) => {
    const subs = channels.get(channel as Channel);
    if (!subs) return;
    const payload = JSON.stringify(message);
    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (pathname === '/ws') {
      handleUpgrade(request, socket as Duplex, head);
    } else {
      socket.destroy();
    }
  });
}
