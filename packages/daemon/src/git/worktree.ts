import { execFileSync } from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/**
 * Create a new git worktree at the given path.
 * Tries with -b first (create new branch). If the branch already exists,
 * falls back to checking out the existing branch.
 */
export function createWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string
): void {
  try {
    execFileSync('git', ['-C', repoPath, 'worktree', 'add', worktreePath, '-b', branch], {
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Branch already exists — try without -b
    if (message.includes('already exists')) {
      execFileSync('git', ['-C', repoPath, 'worktree', 'add', worktreePath, branch], {
        stdio: 'pipe',
      });
    } else {
      throw err;
    }
  }
}

/**
 * Forcefully remove a git worktree.
 */
export function removeWorktree(repoPath: string, worktreePath: string): void {
  execFileSync('git', ['-C', repoPath, 'worktree', 'remove', worktreePath, '--force'], {
    stdio: 'pipe',
  });
}

/**
 * List all git worktrees in porcelain format and parse the output.
 */
export function listWorktrees(repoPath: string): WorktreeInfo[] {
  const output = execFileSync('git', ['-C', repoPath, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const worktrees: WorktreeInfo[] = [];
  const blocks = output.split('\n\n').filter((block) => block.trim().length > 0);

  for (const block of blocks) {
    const lines = block.split('\n');
    let wtPath = '';
    let branch = '';
    let head = '';

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        // branch refs/heads/main -> main
        branch = line.slice('branch '.length).replace('refs/heads/', '');
      }
    }

    if (wtPath) {
      worktrees.push({ path: wtPath, branch, head });
    }
  }

  return worktrees;
}

/**
 * Check if a worktree has no uncommitted changes.
 */
export function isWorktreeClean(worktreePath: string): boolean {
  const output = execFileSync('git', ['-C', worktreePath, 'status', '--porcelain'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return output.trim().length === 0;
}
