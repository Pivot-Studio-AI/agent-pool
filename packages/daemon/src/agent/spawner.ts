import { spawn, execFileSync, type ChildProcess } from 'child_process';

export interface SpawnedAgent {
  process: ChildProcess;
  kill: () => void;
}

export interface SpawnOptions {
  mode?: 'headless' | 'tmux';
  tmuxSession?: string;
  slotNumber?: number;
}

/**
 * Spawn a Claude Code CLI process in the given worktree.
 * Supports headless mode (default) and tmux mode for visibility.
 */
export function spawnAgent(
  worktreePath: string,
  prompt: string,
  model: string,
  options?: SpawnOptions
): SpawnedAgent {
  const mode = options?.mode ?? 'headless';

  if (mode === 'tmux' && options?.tmuxSession) {
    return spawnAgentInTmux(worktreePath, prompt, model, options.tmuxSession, options.slotNumber ?? 0);
  }

  const proc = spawn(
    'claude',
    [
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
      '--verbose',
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
 * Spawn a Claude agent in a tmux window for visibility.
 * Falls back to headless if tmux is not available.
 */
function spawnAgentInTmux(
  worktreePath: string,
  prompt: string,
  model: string,
  sessionName: string,
  slotNumber: number
): SpawnedAgent {
  const windowName = `slot-${slotNumber}`;

  // Ensure tmux session exists
  try {
    execFileSync('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
  } catch {
    // Session doesn't exist, create it
    try {
      execFileSync('tmux', ['new-session', '-d', '-s', sessionName, '-n', 'daemon'], { stdio: 'pipe' });
    } catch (err) {
      console.warn(`[spawner] tmux not available, falling back to headless mode`);
      return spawnAgent(worktreePath, prompt, model);
    }
  }

  // Escape prompt for shell
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const claudeCmd = `cd '${worktreePath}' && claude --dangerously-skip-permissions --output-format stream-json --verbose --max-turns 50 --model ${model} -p '${escapedPrompt}'`;

  // Create a new tmux window for this slot
  const proc = spawn(
    'tmux',
    ['new-window', '-t', sessionName, '-n', windowName, claudeCmd],
    {
      cwd: worktreePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );

  console.log(`[spawner] Spawned claude agent in tmux ${sessionName}:${windowName} (slot ${slotNumber})`);
  console.log(`[spawner] Attach with: tmux attach -t ${sessionName}`);

  // In tmux mode, we don't get stdout/stderr — the agent runs in the tmux window
  // We monitor via .agent-status files and server polling instead
  return {
    process: proc,
    kill: () => {
      try {
        execFileSync('tmux', ['kill-window', '-t', `${sessionName}:${windowName}`], { stdio: 'pipe' });
      } catch { /* window may already be closed */ }
    },
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
