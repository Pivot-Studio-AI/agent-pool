// In production, VITE_API_URL points to the Railway server (e.g., https://agent-pool-server-production.up.railway.app)
// In dev, it's empty and the Vite proxy handles /api → localhost:3100
const SERVER_URL = (import.meta.env.VITE_API_URL as string) || '';

export const API_BASE = `${SERVER_URL}/api/v1`;

export const WS_URL = SERVER_URL
  ? `${SERVER_URL.replace('http', 'ws')}/ws`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export const STATUS_COLORS: Record<string, string> = {
  queued: 'text-text-muted',
  planning: 'text-accent',
  awaiting_approval: 'text-amber',
  executing: 'text-green',
  awaiting_review: 'text-amber',
  merging: 'text-purple',
  deploying: 'text-purple',
  completed: 'text-green',
  errored: 'text-red',
  rejected: 'text-red',
  cancelled: 'text-text-muted',
};

export const STATUS_BG_COLORS: Record<string, string> = {
  queued: 'bg-text-muted/20',
  planning: 'bg-accent/20',
  awaiting_approval: 'bg-amber/20',
  executing: 'bg-green/20',
  awaiting_review: 'bg-amber/20',
  merging: 'bg-purple/20',
  deploying: 'bg-purple/20',
  completed: 'bg-green/20',
  errored: 'bg-red/20',
  rejected: 'bg-red/20',
  cancelled: 'bg-text-muted/20',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-text-muted',
  medium: 'text-text-secondary',
  high: 'text-amber',
  critical: 'text-red',
};

export const RECONNECT = { initialDelay: 1000, maxDelay: 30000, multiplier: 2 };
