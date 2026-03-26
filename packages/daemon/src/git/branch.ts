import { execFileSync } from 'child_process';

/**
 * Checkout an existing branch in the worktree.
 */
export function checkoutBranch(worktreePath: string, branch: string): void {
  execFileSync('git', ['-C', worktreePath, 'checkout', branch], {
    stdio: 'pipe',
  });
}

/**
 * Create and checkout a new branch based on baseBranch.
 */
export function createBranch(
  worktreePath: string,
  branchName: string,
  baseBranch: string
): void {
  execFileSync('git', ['-C', worktreePath, 'checkout', '-B', branchName, baseBranch], {
    stdio: 'pipe',
  });
}

/**
 * Pull latest changes with fast-forward only.
 * Catches errors gracefully (e.g., no remote tracking branch).
 */
export function pullLatest(worktreePath: string): void {
  try {
    execFileSync('git', ['-C', worktreePath, 'pull', '--ff-only'], {
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Gracefully handle cases where there's no remote tracking branch
    if (
      message.includes('no tracking information') ||
      message.includes('There is no tracking information') ||
      message.includes('You are not currently on a branch') ||
      message.includes('no such ref')
    ) {
      console.warn(`[git] pullLatest: no remote tracking branch, skipping pull.`);
    } else {
      throw err;
    }
  }
}

/**
 * Delete a branch forcefully from the repo.
 */
export function deleteBranch(repoPath: string, branchName: string): void {
  execFileSync('git', ['-C', repoPath, 'branch', '-D', branchName], {
    stdio: 'pipe',
  });
}

/**
 * Get the current branch name of a worktree.
 */
export function getCurrentBranch(worktreePath: string): string {
  const output = execFileSync(
    'git',
    ['-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD'],
    {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  return output.trim();
}
