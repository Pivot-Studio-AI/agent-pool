import { spawn, type ChildProcess } from 'child_process';

export interface SpawnedAgent {
  process: ChildProcess;
  kill: () => void;
}

/**
 * Spawn a Claude Code CLI process in the given worktree.
 */
export function spawnAgent(
  worktreePath: string,
  prompt: string,
  model: string
): SpawnedAgent {
  const proc = spawn(
    'claude',
    [
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--max-turns',
      '50',
      '--model',
      model,
      '-p',
      prompt,
    ],
    {
      cwd: worktreePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );

  console.log(`[spawner] Spawned claude agent (PID: ${proc.pid}) in ${worktreePath}`);

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) {
      console.error(`[agent stderr] ${text}`);
    }
  });

  return {
    process: proc,
    kill: () => killAgent(proc),
  };
}

/**
 * Send a message to the agent's stdin.
 */
export function sendToAgent(proc: ChildProcess, message: string): void {
  if (proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(message + '\n');
  } else {
    console.warn('[spawner] Cannot write to agent stdin — stream is destroyed or null.');
  }
}

/**
 * Kill an agent process. Sends SIGTERM first, then SIGKILL after 5 seconds.
 */
export function killAgent(proc: ChildProcess): void {
  if (proc.killed || proc.exitCode !== null) {
    return;
  }

  console.log(`[spawner] Sending SIGTERM to agent (PID: ${proc.pid})`);
  proc.kill('SIGTERM');

  const forceKillTimer = setTimeout(() => {
    if (!proc.killed && proc.exitCode === null) {
      console.log(`[spawner] Agent still alive after 5s, sending SIGKILL (PID: ${proc.pid})`);
      proc.kill('SIGKILL');
    }
  }, 5000);

  proc.once('exit', () => {
    clearTimeout(forceKillTimer);
  });
}
