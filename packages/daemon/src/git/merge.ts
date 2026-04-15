import { execFileSync } from 'child_process';

export interface MergeResult {
  success: boolean;
  error?: string;
}

export interface PushResult {
  success: boolean;
  error?: string;
}

/**
 * Merge taskBranch into targetBranch using a worktree-safe strategy.
 *
 * In a git worktree, you CANNOT checkout the target branch (e.g., main)
 * because it's already checked out by the parent repo. Instead we:
 * 1. Fetch the latest target from origin
 * 2. Merge origin/target into the task branch (so the task branch includes target's changes)
 * 3. Push the result to the remote target branch
 */
export function mergeBranch(
  worktreePath: string,
  targetBranch: string,
  _taskBranch: string
): MergeResult {
  try {
    // Ensure all changes are committed before merging (prevents "untracked files would be overwritten")
    try {
      execFileSync('git', ['-C', worktreePath, 'add', '-A'], { stdio: 'pipe' });
      execFileSync('git', ['-C', worktreePath, 'diff', '--cached', '--quiet'], { stdio: 'pipe' });
    } catch {
      // There are staged changes — commit them
      execFileSync('git', ['-C', worktreePath, 'commit', '-m', 'chore: commit remaining changes before merge'], { stdio: 'pipe' });
    }

    // Fetch latest target branch from remote
    execFileSync('git', ['-C', worktreePath, 'fetch', 'origin', targetBranch], {
      stdio: 'pipe',
    });

    // Merge origin/target into current branch (task branch) with --no-ff
    execFileSync('git', ['-C', worktreePath, 'merge', '--no-ff', `origin/${targetBranch}`, '-m', `Merge ${targetBranch} into task branch`], {
      stdio: 'pipe',
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Attempt to abort the merge if it failed mid-way
    try {
      execFileSync('git', ['-C', worktreePath, 'merge', '--abort'], {
        stdio: 'pipe',
      });
    } catch {
      // merge --abort may fail if there's no merge in progress, ignore
    }

    // Clean up worktree after failed merge
    try {
      execFileSync('git', ['-C', worktreePath, 'reset', '--hard', 'HEAD'], { stdio: 'pipe' });
      execFileSync('git', ['-C', worktreePath, 'clean', '-fd'], { stdio: 'pipe' });
    } catch {
      // Best effort cleanup
    }

    // Check for unmerged files
    let hasConflicts = false;
    try {
      const status = execFileSync('git', ['-C', worktreePath, 'diff', '--name-only', '--diff-filter=U'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      hasConflicts = status.length > 0;
    } catch {
      hasConflicts = message.includes('CONFLICT') || message.includes('conflict');
    }

    return {
      success: false,
      error: hasConflicts
        ? `Merge conflict detected: ${message}`
        : `Merge failed: ${message}`,
    };
  }
}

/**
 * Push the current branch (task branch) to a remote target branch.
 * Uses `HEAD:targetBranch` to push the worktree's current branch to the remote target.
 */
export function pushBranch(worktreePath: string, targetBranch: string): PushResult {
  try {
    execFileSync('git', ['-C', worktreePath, 'push', 'origin', `HEAD:${targetBranch}`], {
      stdio: 'pipe',
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // If push fails, undo the local merge commit to prevent slot contamination
    try {
      execFileSync('git', ['-C', worktreePath, 'reset', '--hard', 'HEAD~1'], { stdio: 'pipe' });
    } catch {
      // Best effort — if reset fails, cleanup will handle it
    }

    return {
      success: false,
      error: `Push failed: ${message}`,
    };
  }
}
