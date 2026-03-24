import * as api from './api.js';

/**
 * Start a polling loop at the given interval.
 * Returns a cleanup function that stops the polling.
 */
export function startPolling(
  intervalMs: number,
  callback: () => Promise<void>
): () => void {
  let running = true;

  const timer = setInterval(async () => {
    if (!running) return;
    try {
      await callback();
    } catch (err) {
      console.error('[poller] Polling callback error:', err);
    }
  }, intervalMs);

  return () => {
    running = false;
    clearInterval(timer);
  };
}

/**
 * Start a heartbeat loop that calls api.heartbeat() on a regular interval.
 * Returns a cleanup function that stops the heartbeat.
 */
export function startHeartbeat(
  daemonId: string,
  intervalMs: number = 30000
): () => void {
  const timer = setInterval(async () => {
    try {
      await api.heartbeat(daemonId);
    } catch (err) {
      console.error('[heartbeat] Failed to send heartbeat:', err);
    }
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
