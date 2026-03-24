import { WS_URL, RECONNECT } from '../lib/constants';
import type { WSMessage } from '../lib/types';

type WSHandler = (message: WSMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Set<WSHandler> = new Set();
  private reconnectDelay = RECONNECT.initialDelay;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  subscribe(handler: WSHandler): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: WSHandler): void {
    this.handlers.delete(handler);
  }

  private createConnection(): void {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this._isConnected = true;
        this.reconnectDelay = RECONNECT.initialDelay;
        this.sendSubscribe();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(message));
        } catch {
          // Ignore unparseable messages
        }
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror, so reconnection is handled there
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private sendSubscribe(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          channels: ['tasks', 'events', 'slots'],
        })
      );
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT.multiplier,
      RECONNECT.maxDelay
    );
  }
}

export const wsManager = new WebSocketManager();
