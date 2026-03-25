import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

const HEALTH_CHECK_INTERVAL_MS = 10_000;
const STALL_TIMEOUT_MS = parseInt(process.env.AGENT_STALL_TIMEOUT_MS || '300000', 10); // 5 minutes default

/**
 * Monitors a spawned agent process for health, stalls, and crashes.
 *
 * Events emitted:
 * - 'stall': no output received for >AGENT_STALL_TIMEOUT_MS (default 300s / 5 min)
 * - 'crash': process exited with non-zero code
 * - 'done': process exited with code 0
 */
export class AgentMonitor extends EventEmitter {
  private process: ChildProcess;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastOutputTime: number;

  constructor(proc: ChildProcess) {
    super();
    this.process = proc;
    this.lastOutputTime = Date.now();
  }

  /**
   * Start health monitoring.
   */
  start(): void {
    // Set up the periodic health check
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    // Listen for process exit
    this.process.once('exit', (code: number | null, signal: string | null) => {
      this.stop();
      if (code === 0) {
        this.emit('done');
      } else {
        this.emit('crash', { code, signal });
      }
    });

    // Listen for process errors
    this.process.once('error', (err: Error) => {
      this.stop();
      this.emit('crash', { code: null, signal: null, error: err.message });
    });
  }

  /**
   * Call this whenever output is received from the agent to reset the stall timer.
   */
  onOutput(): void {
    this.lastOutputTime = Date.now();
  }

  /**
   * Stop monitoring (clear interval).
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkHealth(): void {
    // Check if the process is already dead
    if (this.process.killed || this.process.exitCode !== null) {
      this.stop();
      return;
    }

    // Check for stall (no output for >120s)
    const elapsed = Date.now() - this.lastOutputTime;
    if (elapsed > STALL_TIMEOUT_MS) {
      console.warn(
        `[monitor] Agent stall detected: no output for ${Math.round(elapsed / 1000)}s`
      );
      this.emit('stall');
    }
  }
}
