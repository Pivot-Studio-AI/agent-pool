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
 * Merge taskBranch into targetBranch with --no-ff (no fast-forward).
 * Detects merge conflicts from exit code/stderr.
 */
export function mergeBranch(
  worktreePath: string,
  targetBranch: string,
  taskBranch: string
): MergeResult {
  try {
    // First, checkout the target branch
    execFileSync('git', ['-C', worktreePath, 'checkout', targetBranch], {
      stdio: 'pipe',
    });

    // Then merge with --no-ff
    execFileSync('git', ['-C', worktreePath, 'merge', '--no-ff', taskBranch], {
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

    return {
      success: false,
      error: message.includes('CONFLICT')
        ? `Merge conflict detected: ${message}`
        : `Merge failed: ${message}`,
    };
  }
}

/**
 * Push a branch to origin.
 */
export function pushBranch(worktreePath: string, branch: string): PushResult {
  try {
    execFileSync('git', ['-C', worktreePath, 'push', 'origin', branch], {
      stdio: 'pipe',
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Push failed: ${message}`,
    };
  }
}
