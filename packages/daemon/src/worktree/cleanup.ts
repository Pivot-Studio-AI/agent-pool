import { execFileSync } from 'child_process';
import { checkoutBranch, deleteBranch } from '../git/branch.js';
import { isWorktreeClean } from '../git/worktree.js';

/**
 * Clean up a worktree after a task is complete.
 * 1. Checkout the default branch in the worktree
 * 2. Delete the task branch from the repo
 * 3. git clean -fd in the worktree (remove untracked files)
 * 4. git checkout . in the worktree (discard uncommitted changes)
 * 5. Verify clean state
 */
export function cleanupWorktree(
  worktreePath: string,
  repoPath: string,
  taskBranch: string,
  defaultBranch: string
): void {
  console.log(`[cleanup] Cleaning up worktree at ${worktreePath}, task branch: ${taskBranch}`);

  // 1. Detach HEAD so we can delete the task branch.
  // We can't checkout the default branch because git worktrees don't allow
  // the same branch to be checked out in multiple worktrees.
  try {
    execFileSync('git', ['-C', worktreePath, 'checkout', '--detach'], {
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    console.warn(`[cleanup] Detach HEAD failed:`, err);
    // Try harder — reset to the default branch's commit without checking it out
    try {
      execFileSync('git', ['-C', worktreePath, 'checkout', '--detach', `origin/${defaultBranch}`], {
        stdio: 'pipe',
      });
    } catch (resetErr) {
      console.error(`[cleanup] Detach to origin/${defaultBranch} also failed:`, resetErr);
    }
  }

  // 2. Delete the task branch
  try {
    deleteBranch(repoPath, taskBranch);
  } catch (err: unknown) {
    console.warn(`[cleanup] Failed to delete branch ${taskBranch}:`, err);
    // Not fatal — branch may have already been deleted or merged
  }

  // 3. Remove untracked files and directories
  try {
    execFileSync('git', ['-C', worktreePath, 'clean', '-fd'], {
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    console.warn(`[cleanup] git clean -fd failed:`, err);
  }

  // 4. Discard any uncommitted changes
  try {
    execFileSync('git', ['-C', worktreePath, 'checkout', '.'], {
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    console.warn(`[cleanup] git checkout . failed:`, err);
  }

  // 5. Verify clean state
  const clean = isWorktreeClean(worktreePath);
  if (clean) {
    console.log(`[cleanup] Worktree is clean.`);
  } else {
    console.warn(`[cleanup] Worktree at ${worktreePath} is NOT clean after cleanup.`);
  }
}
