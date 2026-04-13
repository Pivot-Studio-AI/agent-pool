import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

export interface AgentStatus {
  slot: number;
  phase: 'setup' | 'planning' | 'executing' | 'testing' | 'pr-open' | 'done' | 'failed' | 'blocked';
  branch: string;
  task: string;
  taskId: string;
  filesChanged: string[];
  updated: string;
}

/**
 * Write .agent-status file in the worktree directory.
 * This file is read by other agents and the dashboard for context awareness.
 */
export function writeAgentStatus(worktreePath: string, status: AgentStatus): void {
  const statusFile = join(worktreePath, '.agent-status');
  writeFileSync(statusFile, JSON.stringify(status, null, 2));
}

/**
 * Read .agent-status from a worktree directory.
 */
export function readAgentStatus(worktreePath: string): AgentStatus | null {
  const statusFile = join(worktreePath, '.agent-status');
  if (!existsSync(statusFile)) return null;
  try {
    return JSON.parse(readFileSync(statusFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read all agent statuses from a pool directory.
 */
export function readAllAgentStatuses(poolDir: string, maxSlots: number): (AgentStatus | null)[] {
  const statuses: (AgentStatus | null)[] = [];
  for (let i = 1; i <= maxSlots; i++) {
    const worktreePath = join(poolDir, `slot-${i}`);
    statuses.push(readAgentStatus(worktreePath));
  }
  return statuses;
}

/**
 * Append a message to the shared broadcast log.
 */
export function broadcast(poolDir: string, source: string, message: string): void {
  // Pool dir could be the .worktrees parent
  const broadcastFile = join(dirname(poolDir), '.broadcast');
  const timestamp = new Date().toISOString();
  appendFileSync(broadcastFile, `${timestamp} [${source}] ${message}\n`);
}

/**
 * Read the broadcast log.
 */
export function readBroadcast(poolDir: string, lastN?: number): string[] {
  const broadcastFile = join(dirname(poolDir), '.broadcast');
  if (!existsSync(broadcastFile)) return [];
  const lines = readFileSync(broadcastFile, 'utf-8').split('\n').filter(Boolean);
  return lastN ? lines.slice(-lastN) : lines;
}
