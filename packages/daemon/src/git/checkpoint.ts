import { execSync } from 'child_process';

const REF_PREFIX = 'refs/agentpool/checkpoints';

/**
 * Create a checkpoint by snapshotting the current worktree state into a private git ref.
 *
 * Uses `git stash create` which creates a stash-like commit object WITHOUT modifying
 * the working tree or index. This is safe to call while the agent is actively writing
 * files — no race condition.
 */
export function createCheckpoint(
  worktreePath: string,
  taskId: string,
  turnNumber: number
): boolean {
  try {
    // Check if there are any changes worth snapshotting
    const status = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    if (!status) {
      return false;
    }

    // git stash create --include-untracked snapshots tracked + untracked files
    // without modifying the working tree or index. Safe during active agent writes.
    const stashHash = execSync('git stash create --include-untracked', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    if (!stashHash) {
      return false;
    }

    // Store the stash commit in a private ref
    const ref = `${REF_PREFIX}/${taskId}/${turnNumber}`;
    execSync(`git update-ref ${ref} ${stashHash}`, {
      cwd: worktreePath,
      stdio: 'pipe',
    });

    return true;
  } catch (err) {
    // Checkpoint failures should never break the agent lifecycle
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[checkpoint] Failed to create checkpoint ${turnNumber}: ${message}`);
    return false;
  }
}

/**
 * List all checkpoints for a task, sorted by turn number.
 */
export function listCheckpoints(
  worktreePath: string,
  taskId: string
): { turnNumber: number; ref: string; commitHash: string }[] {
  try {
    const output = execSync(
      `git for-each-ref --format='%(refname) %(objectname:short)' '${REF_PREFIX}/${taskId}/'`,
      { cwd: worktreePath, encoding: 'utf-8' }
    ).trim();

    if (!output) return [];

    return output
      .split('\n')
      .map((line) => {
        const [ref, commitHash] = line.split(' ');
        const turnNumber = parseInt(ref.split('/').pop() || '0', 10);
        return { turnNumber, ref, commitHash };
      })
      .sort((a, b) => a.turnNumber - b.turnNumber);
  } catch {
    return [];
  }
}

/**
 * Revert to a specific checkpoint.
 */
export function revertToCheckpoint(
  worktreePath: string,
  taskId: string,
  turnNumber: number
): boolean {
  try {
    const ref = `${REF_PREFIX}/${taskId}/${turnNumber}`;
    execSync(`git reset --hard ${ref}`, {
      cwd: worktreePath,
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[checkpoint] Failed to revert to checkpoint ${turnNumber}: ${message}`);
    return false;
  }
}

/**
 * Clean up all checkpoint refs for a task.
 */
export function cleanupCheckpoints(
  worktreePath: string,
  taskId: string
): void {
  try {
    const checkpoints = listCheckpoints(worktreePath, taskId);
    for (const cp of checkpoints) {
      execSync(`git update-ref -d ${cp.ref}`, {
        cwd: worktreePath,
        stdio: 'pipe',
      });
    }
    if (checkpoints.length > 0) {
      console.log(`[checkpoint] Cleaned up ${checkpoints.length} checkpoint(s) for task ${taskId.slice(0, 8)}`);
    }
  } catch {
    // Best effort cleanup
  }
}
