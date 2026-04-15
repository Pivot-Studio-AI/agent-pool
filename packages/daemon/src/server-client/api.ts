import { config } from '../config.js';

const BASE_URL = `${config.serverUrl}/api/v1`;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ---- Types ----

export interface Daemon {
  id: string;
  name: string;
  repo_path: string;
  pool_size: number;
  status: string;
}

export interface Slot {
  id: string;
  slot_number: number;
  status: string;
  worktree_path: string;
  branch_name: string | null;
  current_task_id: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  model_tier: string;
  target_branch: string;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Plan {
  id: string;
  task_id: string;
  content: string;
  file_manifest: string[];
  reasoning: string;
  estimate: string;
  status: string;
  reviewer_feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface DiffSubmission {
  diff_content: string;
  files_changed: { path: string; additions: number; deletions: number }[];
  additions: number;
  deletions: number;
  summary?: string;
  compliance?: Record<string, unknown>;
  audit?: Record<string, unknown>;
}

export interface FileLock {
  id: string;
  task_id: string;
  file_path: string;
  lock_type: string;
  locked_at: string;
}

export interface Repo {
  repo_id: string;
  github_full_name: string;
  github_url: string;
  default_branch: string;
}

// ---- Retry helper ----

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNetworkError =
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('network');

      if (!isNetworkError || attempt === retries) {
        throw lastError;
      }
      console.warn(
        `[api] Request failed (attempt ${attempt}/${retries}): ${lastError.message}. Retrying in ${RETRY_DELAY_MS}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

// ---- Request helper ----

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  return withRetry(async () => {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
    }

    // Some endpoints may return 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  });
}

// ---- API Methods ----

/**
 * Register this daemon with the server.
 */
export async function registerDaemon(
  name: string,
  repoPath: string,
  poolSize: number,
  repoId?: string
): Promise<{ daemon: Daemon; slots: Slot[] }> {
  return request('POST', '/daemon/register', {
    name,
    repo_path: repoPath,
    pool_size: poolSize,
    ...(repoId ? { repo_id: repoId } : {}),
  });
}

/**
 * Send a heartbeat to the server.
 */
export async function heartbeat(daemonId: string): Promise<void> {
  await request('POST', '/daemon/heartbeat', { daemon_id: daemonId });
}

/**
 * Get queued tasks (highest priority first), optionally filtered by repo.
 */
export async function getQueuedTasks(repoId?: string): Promise<Task[]> {
  const repoFilter = repoId ? `&repo_id=${encodeURIComponent(repoId)}` : '';
  return request('GET', `/tasks?status=queued&limit=1${repoFilter}`);
}

/**
 * Get tasks by status (for orphan cleanup).
 */
export async function getTasksByStatus(status: string): Promise<Task[]> {
  return request('GET', `/tasks?status=${status}&limit=50`);
}

/**
 * Get idle slots, optionally filtered by repo.
 */
export async function getIdleSlots(repoId?: string): Promise<Slot[]> {
  const repoFilter = repoId ? `?repo_id=${encodeURIComponent(repoId)}` : '';
  const slots = await request<Slot[]>('GET', `/slots${repoFilter}`);
  return slots.filter((s) => s.status === 'idle');
}

/**
 * Get all repositories (for multi-repo daemon mode).
 */
export async function getAllRepos(): Promise<Repo[]> {
  return request('GET', '/daemon/repos');
}

/**
 * Ensure slots exist for a repo (upserts pool_size slots).
 */
export async function ensureRepoSlots(repoId: string, poolSize: number, basePath: string): Promise<Slot[]> {
  return request('POST', '/daemon/repo-slots', { repo_id: repoId, pool_size: poolSize, base_path: basePath });
}

/**
 * Claim a slot for a task.
 */
export async function claimSlot(
  slotId: string,
  taskId: string,
  daemonId: string
): Promise<Slot> {
  return request('POST', `/slots/${slotId}/claim`, {
    task_id: taskId,
    daemon_id: daemonId,
  });
}

/**
 * Release a slot.
 */
export async function releaseSlot(slotId: string): Promise<void> {
  await request('POST', `/slots/${slotId}/release`);
}

/**
 * Update a task's status.
 * Treats 409 Conflict as success when the task is already in the target state
 * (idempotent transition).
 */
export async function updateTaskStatus(
  taskId: string,
  status: string,
  reason?: string
): Promise<Task> {
  try {
    return await request('PATCH', `/tasks/${taskId}`, { status, reason });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('HTTP 409') && message.includes(`from '${status}' to '${status}'`)) {
      console.warn(`[api] Task ${taskId.slice(0, 8)} already in '${status}' state, treating as success.`);
      return getTask(taskId);
    }
    throw err;
  }
}

/**
 * Get a single task by ID.
 */
export async function getTask(taskId: string): Promise<Task> {
  return request('GET', `/tasks/${taskId}`);
}

/**
 * Submit a plan for a task.
 */
export async function submitPlan(
  taskId: string,
  plan: { content: string; file_manifest: string[]; reasoning: string; estimate: string }
): Promise<Plan> {
  return request('POST', `/tasks/${taskId}/plans`, plan);
}

/**
 * Get plans for a task.
 */
export async function getPlans(taskId: string): Promise<Plan[]> {
  return request('GET', `/tasks/${taskId}/plans`);
}

/**
 * Submit a diff for a task.
 */
export async function submitDiff(
  taskId: string,
  diff: DiffSubmission
): Promise<void> {
  await request('POST', `/tasks/${taskId}/diffs`, diff);
}

/**
 * Acquire file locks for a task.
 */
export async function acquireFileLocks(
  taskId: string,
  files: string[]
): Promise<FileLock[]> {
  return request('POST', '/file-locks', { task_id: taskId, files });
}

/**
 * Release all file locks for a task.
 */
export async function releaseFileLocks(taskId: string): Promise<void> {
  await request('DELETE', `/file-locks?task_id=${taskId}`);
}

/**
 * Check if any files have existing locks.
 */
export async function checkFileConflicts(
  files: string[]
): Promise<FileLock[]> {
  return request('GET', `/file-locks/check?files=${files.join(',')}`);
}

/**
 * Get the review feedback from the latest diff for a task.
 */
export async function getDiffFeedback(taskId: string): Promise<string | null> {
  const result = await request<{ feedback: string | null }>('GET', `/tasks/${taskId}/diffs/feedback`);
  return result.feedback;
}

/**
 * Cancel a task.
 */
export async function cancelTask(taskId: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/cancel`);
}

/**
 * Retry a task (transitions from errored/rejected/cancelled → queued).
 */
export async function retryTask(taskId: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/retry`);
}

/**
 * Update test results on the latest diff for a task.
 */
export async function updateDiffTestResults(taskId: string, testResults: Record<string, unknown>): Promise<void> {
  await request('POST', `/tasks/${taskId}/test-results`, testResults);
}

/**
 * Get the currently selected repo for this daemon.
 * Returns null if no repo is selected.
 */
export async function getCurrentRepo(): Promise<Repo | null> {
  try {
    return await request<Repo>('GET', '/daemon/repo');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404')) {
      return null;
    }
    throw err;
  }
}

/**
 * Acknowledge that the daemon has set up the repo locally.
 * Non-fatal — server may not have this endpoint yet.
 */
export async function ackRepo(
  daemonId: string,
  repoId: string,
  localPath: string
): Promise<void> {
  try {
    await request('POST', '/daemon/repo/ack', {
      daemon_id: daemonId,
      repo_id: repoId,
      local_path: localPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('404')) throw err;
    // 404 means server not yet deployed with this endpoint — safe to ignore
  }
}
