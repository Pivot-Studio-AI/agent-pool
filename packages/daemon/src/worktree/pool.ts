import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { createWorktree, listWorktrees, isWorktreeClean } from '../git/worktree.js';

export class WorktreePool {
  private repoPath: string;
  private poolSize: number;
  private defaultBranch: string;
  private worktreesDir: string;

  constructor(repoPath: string, poolSize: number, defaultBranch: string) {
    this.repoPath = repoPath;
    this.poolSize = poolSize;
    this.defaultBranch = defaultBranch;
    this.worktreesDir = path.join(repoPath, '.worktrees');
  }

  /**
   * Provision worktrees for all slots.
   * Ensures each slot has a worktree on disk.
   */
  async provision(): Promise<void> {
    // Ensure the .worktrees directory exists
    if (!fs.existsSync(this.worktreesDir)) {
      fs.mkdirSync(this.worktreesDir, { recursive: true });
    }

    const existingWorktrees = listWorktrees(this.repoPath);
    const existingPaths = new Set(existingWorktrees.map((wt) => wt.path));

    for (let i = 1; i <= this.poolSize; i++) {
      const wtPath = this.getWorktreePath(i);

      if (fs.existsSync(wtPath) && existingPaths.has(wtPath)) {
        // Detach HEAD to release any task branch (prevents branch collision on retry)
        try {
          execFileSync('git', ['-C', wtPath, 'checkout', '--detach'], { stdio: 'pipe' });
        } catch { /* already detached */ }
        if (!isWorktreeClean(wtPath)) {
          console.warn(`[pool] Slot ${i}: worktree is dirty, cleaning up...`);
          try {
            execFileSync('git', ['-C', wtPath, 'checkout', '.'], { stdio: 'pipe' });
            execFileSync('git', ['-C', wtPath, 'clean', '-fd'], { stdio: 'pipe' });
          } catch (cleanErr) {
            console.error(`[pool] Slot ${i}: failed to clean dirty worktree:`, cleanErr);
          }
        }
        console.log(`[pool] Slot ${i}: worktree ready at ${wtPath}`);
        continue;
      }

      // If directory exists but is not a registered worktree, remove it first
      if (fs.existsSync(wtPath)) {
        console.warn(`[pool] Slot ${i}: stale directory at ${wtPath}, removing...`);
        fs.rmSync(wtPath, { recursive: true, force: true });
      }

      console.log(`[pool] Slot ${i}: creating worktree at ${wtPath}`);
      try {
        createWorktree(this.repoPath, wtPath, this.defaultBranch);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // If the branch already exists in another worktree, that's expected for the default branch
        // Try without creating a new branch
        if (message.includes('already checked out') || message.includes('already exists') || message.includes('already used by worktree')) {
          // The default branch may already be checked out in the main repo.
          // Create with a detached HEAD on the same commit instead.
          const { execFileSync } = await import('child_process');
          const headSha = execFileSync(
            'git',
            ['-C', this.repoPath, 'rev-parse', this.defaultBranch],
            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
          ).trim();
          execFileSync(
            'git',
            ['-C', this.repoPath, 'worktree', 'add', '--detach', wtPath, headSha],
            { stdio: 'pipe' }
          );
          console.log(`[pool] Slot ${i}: created detached worktree at ${wtPath}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`[pool] All ${this.poolSize} worktrees provisioned.`);
  }

  /**
   * Get the filesystem path for a given slot number.
   */
  getWorktreePath(slotNumber: number): string {
    return path.join(this.worktreesDir, `slot-${slotNumber}`);
  }

  /**
   * Clean up a slot after a task completes.
   */
  async cleanup(slotNumber: number, taskBranch: string): Promise<void> {
    const { cleanupWorktree } = await import('./cleanup.js');
    const wtPath = this.getWorktreePath(slotNumber);
    cleanupWorktree(wtPath, this.repoPath, taskBranch, this.defaultBranch);
  }
}
