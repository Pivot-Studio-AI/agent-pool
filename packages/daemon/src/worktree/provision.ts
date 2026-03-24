import path from 'path';
import fs from 'fs';
import { createWorktree, removeWorktree } from '../git/worktree.js';

/**
 * Provision a worktree for a specific slot.
 */
export function provisionWorktree(
  repoPath: string,
  slotNumber: number,
  baseBranch: string
): string {
  const worktreesDir = path.join(repoPath, '.worktrees');
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  const worktreePath = path.join(worktreesDir, `slot-${slotNumber}`);

  if (fs.existsSync(worktreePath)) {
    console.warn(`[provision] Worktree already exists at ${worktreePath}, removing first...`);
    try {
      removeWorktree(repoPath, worktreePath);
    } catch {
      // Force-remove the directory if git worktree remove fails
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  }

  createWorktree(repoPath, worktreePath, baseBranch);
  console.log(`[provision] Created worktree for slot ${slotNumber} at ${worktreePath}`);
  return worktreePath;
}

/**
 * Destroy a worktree for a specific slot.
 */
export function destroyWorktree(repoPath: string, slotNumber: number): void {
  const worktreePath = path.join(repoPath, '.worktrees', `slot-${slotNumber}`);

  if (!fs.existsSync(worktreePath)) {
    console.warn(`[provision] Worktree for slot ${slotNumber} does not exist, nothing to destroy.`);
    return;
  }

  try {
    removeWorktree(repoPath, worktreePath);
    console.log(`[provision] Destroyed worktree for slot ${slotNumber}`);
  } catch (err: unknown) {
    console.error(`[provision] Failed to remove worktree, force-deleting directory:`, err);
    fs.rmSync(worktreePath, { recursive: true, force: true });
  }
}
