import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const SETUP_TIMEOUT = 120_000; // 2 minutes
const TEARDOWN_TIMEOUT = 30_000; // 30 seconds

export interface WorkspaceConfig {
  setup?: string;
  teardown?: string;
  env?: Record<string, string>;
}

/**
 * Read .agentpool/config.json from a repo root.
 * Returns null if file doesn't exist.
 */
export function readWorkspaceConfig(repoPath: string): WorkspaceConfig | null {
  const configPath = path.join(repoPath, '.agentpool', 'config.json');
  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as WorkspaceConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[lifecycle] Failed to read .agentpool/config.json: ${message}`);
    return null;
  }
}

/**
 * Build environment variables for a slot, including config-defined env vars
 * with slot-specific substitutions.
 */
function buildSlotEnv(slotNumber: number, configEnv?: Record<string, string>): Record<string, string> {
  const slotPort = String(3000 + slotNumber * 10);
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    SLOT_NUMBER: String(slotNumber),
    SLOT_PORT: slotPort,
  };

  if (configEnv) {
    for (const [key, value] of Object.entries(configEnv)) {
      // Substitute $SLOT_PORT and $SLOT_NUMBER in values
      env[key] = value
        .replace(/\$SLOT_PORT/g, slotPort)
        .replace(/\$SLOT_NUMBER/g, String(slotNumber));
    }
  }

  return env;
}

/**
 * Run a shell command with a timeout. Returns true on success.
 */
function runScript(
  script: string,
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  label: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = exec(script, {
      cwd,
      env,
      timeout: timeoutMs,
      shell: process.env.SHELL || '/bin/sh',
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data; });
    child.stderr?.on('data', (data) => { stderr += data; });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[lifecycle] ${label} completed successfully`);
        resolve(true);
      } else {
        console.warn(`[lifecycle] ${label} failed (exit code ${code})`);
        if (stderr) console.warn(`[lifecycle] stderr: ${stderr.slice(0, 500)}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      console.warn(`[lifecycle] ${label} error: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Run the setup script for a worktree slot.
 */
export async function runSetup(
  worktreePath: string,
  slotNumber: number,
  wsConfig: WorkspaceConfig | null
): Promise<boolean> {
  if (!wsConfig?.setup) return true; // No setup needed

  const env = buildSlotEnv(slotNumber, wsConfig.env);
  console.log(`[lifecycle] Running setup for slot ${slotNumber}: ${wsConfig.setup}`);

  return runScript(
    wsConfig.setup,
    worktreePath,
    env,
    SETUP_TIMEOUT,
    `setup (slot ${slotNumber})`
  );
}

/**
 * Run the teardown script for a worktree slot.
 */
export async function runTeardown(
  worktreePath: string,
  slotNumber: number,
  wsConfig: WorkspaceConfig | null
): Promise<boolean> {
  if (!wsConfig?.teardown) return true; // No teardown needed

  const env = buildSlotEnv(slotNumber, wsConfig.env);
  console.log(`[lifecycle] Running teardown for slot ${slotNumber}: ${wsConfig.teardown}`);

  return runScript(
    wsConfig.teardown,
    worktreePath,
    env,
    TEARDOWN_TIMEOUT,
    `teardown (slot ${slotNumber})`
  );
}
