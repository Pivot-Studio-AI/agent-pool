import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { config } from './config.js';
import * as api from './server-client/api.js';
import { startPolling, startHeartbeat } from './server-client/poller.js';
import { WorktreePool } from './worktree/pool.js';
import { spawnAgent } from './agent/spawner.js';
import { OutputParser } from './agent/output-parser.js';
import { extractPlan } from './agent/plan-extractor.js';
import { AgentMonitor } from './agent/monitor.js';
import { checkoutBranch, createBranch, pullLatest } from './git/branch.js';
import { generateDiff, parseDiffStats } from './git/diff.js';
import { mergeBranch, pushBranch } from './git/merge.js';
import { cleanupWorktree } from './worktree/cleanup.js';
import { ensureRepo } from './git/clone.js';
import { createCheckpoint, cleanupCheckpoints } from './git/checkpoint.js';
import { readWorkspaceConfig, runSetup, runTeardown } from './worktree/lifecycle.js';

// ---- Model Routing ----

const MODEL_MAP: Record<string, string> = {
  fast: 'claude-opus-4-6',
  default: 'claude-opus-4-6',
  powerful: 'claude-opus-4-6',
};

/**
 * Resolve model_tier to an actual model ID.
 * Falls back to config.defaultModel if tier is unknown.
 */
function resolveModel(modelTier: string): string {
  return MODEL_MAP[modelTier] || config.defaultModel;
}

// ---- Types ----

interface ActiveAgent {
  taskId: string;
  slotId: string;
  slotNumber: number;
  branchName: string;
  kill: () => void;
}

// ---- State ----

let shuttingDown = false;
const activeAgents = new Map<string, ActiveAgent>();

// ---- Main ----

async function main(): Promise<void> {
  console.log('[daemon] Starting Agent Pool daemon...');
  console.log(`[daemon] Pool size: ${config.poolSize}`);
  console.log(`[daemon] Server: ${config.serverUrl}`);

  if (config.repoPath) {
    console.log(`[daemon] Mode: fixed (REPO_PATH=${config.repoPath})`);
    await runFixedMode();
  } else {
    console.log(`[daemon] Mode: dynamic (REPOS_BASE_DIR=${config.reposBaseDir})`);
    await runDynamicMode();
  }
}

// ---- Fixed Mode (original behavior when REPO_PATH is set) ----

async function runFixedMode(): Promise<void> {
  const repoPath = config.repoPath!;
  console.log(`[daemon] Repo: ${repoPath}`);

  // 1. Validate repo path exists and has .git
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repo path does not exist: ${repoPath}`);
  }
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Not a git repository (no .git): ${repoPath}`);
  }
  console.log('[daemon] Git repository validated.');

  // 2. Register daemon
  const hostname = (await import('os')).default.hostname();
  const daemonName = `daemon-${hostname}-${process.pid}`;
  console.log(`[daemon] Registering as "${daemonName}"...`);

  const { daemon, slots } = await api.registerDaemon(
    daemonName,
    repoPath,
    config.poolSize
  );
  const daemonId = daemon.id;
  console.log(`[daemon] Registered with ID: ${daemonId}, ${slots.length} slots created.`);

  // 3. Provision worktree pool
  const pool = new WorktreePool(repoPath, config.poolSize, config.defaultBranch);
  await pool.provision();

  // 4. Start heartbeat (every 30s)
  const stopHeartbeat = startHeartbeat(daemonId, 30_000);
  console.log('[daemon] Heartbeat started (30s interval).');

  // 5. Start polling loop
  const stopPolling = startPolling(config.pollIntervalMs, async () => {
    if (shuttingDown) return;

    try {
      const tasks = await api.getQueuedTasks();
      if (!tasks.length) return;

      const idleSlots = await api.getIdleSlots();
      if (!idleSlots.length) return;

      const task = tasks[0];
      const slot = idleSlots[0];

      try {
        await api.claimSlot(slot.id, task.id, daemonId);
      } catch {
        // Another daemon claimed it first — skip
        return;
      }

      // Immediately move task out of 'queued' so the next poll tick won't pick it up again
      try {
        await api.updateTaskStatus(task.id, 'planning');
      } catch {
        // If this fails, the lifecycle will retry — not fatal here
      }

      console.log(
        `[daemon] Task "${task.title}" (${task.id}) claimed slot ${slot.slot_number}`
      );

      // Run the agent lifecycle without blocking the polling loop
      runAgentLifecycle(task, slot, daemonId, pool, repoPath).catch((err) => {
        console.error(`[daemon] Unhandled error in agent lifecycle for task ${task.id}:`, err);
      });
    } catch (err) {
      console.error('[daemon] Polling error:', err);
    }
  });
  console.log(`[daemon] Polling started (${config.pollIntervalMs}ms interval).`);
  console.log('[daemon] Ready. Waiting for tasks...');

  // ---- Graceful shutdown ----
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[daemon] Received ${signal}. Shutting down gracefully...`);

    stopPolling();
    stopHeartbeat();

    // Wait for active agents with a timeout
    if (activeAgents.size > 0) {
      console.log(`[daemon] Waiting for ${activeAgents.size} active agent(s) to finish...`);
      const timeout = 30_000;
      const start = Date.now();

      while (activeAgents.size > 0 && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Kill remaining agents
      if (activeAgents.size > 0) {
        console.log(`[daemon] Timeout reached. Killing ${activeAgents.size} remaining agent(s).`);
        for (const agent of activeAgents.values()) {
          agent.kill();
          try {
            await api.updateTaskStatus(agent.taskId, 'errored', 'Daemon shutdown — task interrupted');
          } catch { /* best effort */ }
          try {
            await api.releaseSlot(agent.slotId);
          } catch { /* best effort */ }
        }
      }
    }

    console.log('[daemon] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ---- Dynamic Mode (when REPO_PATH is not set, polls server for repo) ----

async function runDynamicMode(): Promise<void> {
  console.log('[daemon] Running in dynamic mode. Waiting for repo selection...');

  // Register daemon (without a fixed repo)
  const hostname = (await import('os')).default.hostname();
  const daemonName = `daemon-${hostname}-${process.pid}`;
  console.log(`[daemon] Registering as "${daemonName}"...`);

  const { daemon } = await api.registerDaemon(
    daemonName,
    config.reposBaseDir,
    config.poolSize
  );
  const daemonId = daemon.id;
  console.log(`[daemon] Registered with ID: ${daemonId}`);

  // Start heartbeat
  const stopHeartbeat = startHeartbeat(daemonId, 30_000);
  console.log('[daemon] Heartbeat started (30s interval).');

  let currentRepoId: string | null = null;
  let currentRepoPath: string | null = null;
  let currentDefaultBranch: string = config.defaultBranch;
  let pool: WorktreePool | null = null;
  let stopTaskPolling: (() => void) | null = null;

  // Poll for repo selection every 5 seconds
  const repoCheckInterval = setInterval(async () => {
    if (shuttingDown) return;

    try {
      const repo = await api.getCurrentRepo();
      if (!repo) return;

      if (repo.repo_id === currentRepoId) return; // No change

      console.log(`[daemon] Repo selected: ${repo.github_full_name}`);

      // If we were working on another repo, stop task polling
      if (stopTaskPolling) {
        stopTaskPolling();
        stopTaskPolling = null;
      }

      if (pool && currentRepoPath) {
        console.log('[daemon] Switching repos. Cleaning up previous pool...');
        // Note: active agents on the old repo will finish naturally via activeAgents map
      }

      // Ensure repo exists locally (clone if needed)
      const repoPath = ensureRepo(
        repo.github_full_name,
        repo.github_url,
        config.reposBaseDir
      );

      currentRepoId = repo.repo_id;
      currentRepoPath = repoPath;
      currentDefaultBranch = repo.default_branch || config.defaultBranch;

      // Acknowledge repo setup to server
      await api.ackRepo(daemonId, repo.repo_id, repoPath);
      console.log(`[daemon] Repo acknowledged: ${repoPath}`);

      // Provision worktrees for this repo
      pool = new WorktreePool(repoPath, config.poolSize, currentDefaultBranch);
      await pool.provision();

      // Start task polling for this repo
      stopTaskPolling = startPolling(config.pollIntervalMs, async () => {
        if (shuttingDown) return;

        try {
          const tasks = await api.getQueuedTasks();
          if (!tasks.length) return;

          const idleSlots = await api.getIdleSlots();
          if (!idleSlots.length) return;

          const task = tasks[0];
          const slot = idleSlots[0];

          try {
            await api.claimSlot(slot.id, task.id, daemonId);
          } catch {
            // Another daemon claimed it first — skip
            return;
          }

          // Immediately move task out of 'queued' so the next poll tick won't pick it up again
          try {
            await api.updateTaskStatus(task.id, 'planning');
          } catch {
            // If this fails, the lifecycle will retry — not fatal here
          }

          console.log(
            `[daemon] Task "${task.title}" (${task.id}) claimed slot ${slot.slot_number}`
          );

          // Run agent lifecycle with the current repo path
          runAgentLifecycle(task, slot, daemonId, pool!, currentRepoPath!, currentDefaultBranch).catch((err) => {
            console.error(`[daemon] Unhandled error in agent lifecycle for task ${task.id}:`, err);
          });
        } catch (err) {
          console.error('[daemon] Polling error:', err);
        }
      });

      console.log(`[daemon] Now working on ${repo.github_full_name} at ${repoPath}`);
    } catch (err) {
      console.error('[daemon] Repo check error:', err);
    }
  }, 5000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[daemon] Received ${signal}. Shutting down gracefully...`);

    clearInterval(repoCheckInterval);
    if (stopTaskPolling) stopTaskPolling();
    stopHeartbeat();

    // Wait for active agents with a timeout
    if (activeAgents.size > 0) {
      console.log(`[daemon] Waiting for ${activeAgents.size} active agent(s) to finish...`);
      const timeout = 30_000;
      const start = Date.now();

      while (activeAgents.size > 0 && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Kill remaining agents
      if (activeAgents.size > 0) {
        console.log(`[daemon] Timeout reached. Killing ${activeAgents.size} remaining agent(s).`);
        for (const agent of activeAgents.values()) {
          agent.kill();
          try {
            await api.updateTaskStatus(agent.taskId, 'errored', 'Daemon shutdown — task interrupted');
          } catch { /* best effort */ }
          try {
            await api.releaseSlot(agent.slotId);
          } catch { /* best effort */ }
        }
      }
    }

    console.log('[daemon] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ---- Agent Lifecycle ----

async function runAgentLifecycle(
  task: api.Task,
  slot: api.Slot,
  daemonId: string,
  pool: WorktreePool,
  repoPath?: string,
  defaultBranch?: string
): Promise<void> {
  const effectiveRepoPath = repoPath ?? config.repoPath!;
  const effectiveDefaultBranch = defaultBranch ?? config.defaultBranch;
  const taskId = task.id;
  const slotId = slot.id;
  const slotNumber = slot.slot_number;
  const worktreePath = pool.getWorktreePath(slotNumber);
  const branchName = `agent-pool/task-${taskId.slice(0, 8)}`;

  const agentEntry: ActiveAgent = {
    taskId,
    slotId,
    slotNumber,
    branchName,
    kill: () => {}, // Will be set when agent is spawned
  };
  activeAgents.set(taskId, agentEntry);

  try {
    // 1. Prepare worktree — fetch latest remote state, then create task branch
    console.log(`[lifecycle:${taskId.slice(0, 8)}] Preparing worktree at ${worktreePath}`);
    try {
      const { execFileSync } = await import('child_process');
      execFileSync('git', ['-C', worktreePath, 'fetch', 'origin', effectiveDefaultBranch], {
        stdio: 'pipe',
      });
    } catch {
      console.warn(`[lifecycle:${taskId.slice(0, 8)}] fetch failed, continuing with local state`);
    }
    createBranch(worktreePath, branchName, `origin/${effectiveDefaultBranch}`);

    // 1b. Run workspace setup if configured
    const wsConfig = readWorkspaceConfig(effectiveRepoPath);
    if (wsConfig?.setup) {
      const setupOk = await runSetup(worktreePath, slotNumber, wsConfig);
      if (!setupOk) {
        console.error(`[lifecycle:${taskId.slice(0, 8)}] Workspace setup failed, aborting task.`);
        await api.updateTaskStatus(taskId, 'errored', 'Workspace setup script failed');
        return;
      }
    }

    // Check cancellation after setup
    const postSetupCheck = await api.getTask(taskId);
    if (postSetupCheck.status === 'cancelled') {
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Task cancelled during setup.`);
      return;
    }

    // 2. Resolve model based on task tier
    const taskModel = resolveModel(task.model_tier);
    console.log(`[lifecycle:${taskId.slice(0, 8)}] Model: ${taskModel} (tier: ${task.model_tier})`);

    // 3. Update task status to planning
    await api.updateTaskStatus(taskId, 'planning');

    // 4. Build the plan prompt
    const prompt = buildPlanPrompt(task, effectiveRepoPath);

    // 4. Run planning phase (may loop if plan is rejected, up to MAX_PLAN_RETRIES)
    const MAX_PLAN_RETRIES = parseInt(process.env.MAX_PLAN_RETRIES || '3', 10);
    let approved = false;
    let planFileManifest: string[] = [];
    let currentPlanPrompt = prompt;

    for (let planAttempt = 1; planAttempt <= MAX_PLAN_RETRIES && !shuttingDown; planAttempt++) {
      // Check if task was cancelled
      const taskCheck = await api.getTask(taskId);
      if (taskCheck.status === 'cancelled') {
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Task cancelled during planning.`);
        return;
      }

      // Spawn agent for planning
      const planResult = await runPlanningAgent(taskId, worktreePath, currentPlanPrompt, taskModel);

      if (!planResult) {
        throw new Error('Agent exited without producing a plan');
      }

      // Submit plan to server
      const plan = await api.submitPlan(taskId, {
        content: planResult.content,
        file_manifest: planResult.fileManifest,
        reasoning: planResult.reasoning,
        estimate: planResult.estimate,
      });
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Plan submitted (${plan.id}) — attempt ${planAttempt}/${MAX_PLAN_RETRIES}`);

      // Update task to awaiting_approval
      await api.updateTaskStatus(taskId, 'awaiting_approval');

      // Poll for approval
      const decision = await waitForPlanDecision(taskId);

      if (decision.status === 'approved') {
        approved = true;
        planFileManifest = planResult.fileManifest;
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Plan approved!`);
        break;
      } else if (decision.status === 'rejected') {
        if (decision.feedback && planAttempt < MAX_PLAN_RETRIES) {
          console.log(
            `[lifecycle:${taskId.slice(0, 8)}] Plan rejected (attempt ${planAttempt}/${MAX_PLAN_RETRIES}). Feedback: ${decision.feedback}`
          );
          await api.updateTaskStatus(taskId, 'planning');
          currentPlanPrompt = buildRejectionPrompt(task, decision.feedback, effectiveRepoPath);
          // Loop continues with new prompt
        } else {
          // No feedback or max retries reached — permanently rejected
          console.log(`[lifecycle:${taskId.slice(0, 8)}] Plan permanently rejected (attempt ${planAttempt}).`);
          await api.updateTaskStatus(taskId, 'rejected');
          return;
        }
      }
    }

    if (!approved) {
      if (!shuttingDown) {
        await api.updateTaskStatus(taskId, 'rejected');
      }
      return;
    }

    if (shuttingDown) return;

    // 5. Acquire file locks — abort if we can't get them
    if (planFileManifest.length > 0) {
      try {
        await api.acquireFileLocks(taskId, planFileManifest);
        console.log(
          `[lifecycle:${taskId.slice(0, 8)}] Acquired locks on ${planFileManifest.length} file(s)`
        );
      } catch (err) {
        const lockErr = err instanceof Error ? err.message : String(err);
        console.error(`[lifecycle:${taskId.slice(0, 8)}] Failed to acquire file locks: ${lockErr}`);
        await api.updateTaskStatus(taskId, 'errored', `File locks unavailable: ${lockErr}`);
        return;
      }
    }

    // 6. Execute implementation
    // The dashboard may have already transitioned to 'executing' when approving the plan.
    // Only transition if not already there.
    const preExecTask = await api.getTask(taskId);
    if (preExecTask.status !== 'executing') {
      await api.updateTaskStatus(taskId, 'executing');
    }
    await runExecutionAgent(taskId, worktreePath, task, agentEntry, planFileManifest, taskModel, effectiveRepoPath);

    if (shuttingDown) return;

    // Check cancellation after execution
    const postExecCheck = await api.getTask(taskId);
    if (postExecCheck.status === 'cancelled') {
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Task cancelled after execution.`);
      return;
    }

    // 6b. Enforce plan manifest — revert changes to files not in the plan
    if (planFileManifest.length > 0) {
      const { execFileSync } = await import('child_process');
      const normalizePath = (p: string) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
      const planned = new Set(planFileManifest.map(normalizePath));

      // Get list of files the agent actually changed
      const changedFiles = execFileSync(
        'git', ['-C', worktreePath, 'diff', '--name-only', `origin/${effectiveDefaultBranch}...HEAD`],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim().split('\n').filter(Boolean);

      const offPlanFiles = changedFiles.filter(f => !planned.has(normalizePath(f)));
      if (offPlanFiles.length > 0) {
        console.warn(`[lifecycle:${taskId.slice(0, 8)}] Reverting ${offPlanFiles.length} off-plan file(s): ${offPlanFiles.join(', ')}`);
        // Revert each off-plan file to its state on the base branch
        for (const file of offPlanFiles) {
          try {
            execFileSync(
              'git', ['-C', worktreePath, 'checkout', `origin/${effectiveDefaultBranch}`, '--', file],
              { stdio: 'pipe' }
            );
          } catch {
            console.warn(`[lifecycle:${taskId.slice(0, 8)}] Failed to revert ${file}, skipping`);
          }
        }
        // Amend the commit to exclude the reverted files
        execFileSync('git', ['-C', worktreePath, 'add', '-A'], { stdio: 'pipe' });
        execFileSync(
          'git', ['-C', worktreePath, 'commit', '--amend', '--no-edit'],
          { stdio: 'pipe' }
        );
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Off-plan changes reverted and commit amended.`);
      }
    }

    // 6c. Type-check gate — compare against baseline to only catch NEW errors
    {
      const { execFileSync: execSync } = await import('child_process');

      // Get baseline tsc errors from the base branch
      let baselineErrors = '';
      try {
        execSync('npx', ['tsc', '--noEmit'], {
          cwd: effectiveRepoPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 60_000,
        });
      } catch (baseErr: unknown) {
        baselineErrors = (baseErr as any)?.stdout || (baseErr as any)?.stderr || '';
      }
      const baselineErrorCount = (baselineErrors.match(/error TS/g) || []).length;

      // Check the agent's worktree
      let agentErrors = '';
      let agentErrorCount = 0;
      try {
        execSync('npx', ['tsc', '--noEmit'], {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 60_000,
        });
        console.log(`[lifecycle:${taskId.slice(0, 8)}] tsc passed (0 errors)`);
      } catch (tscErr: unknown) {
        agentErrors = (tscErr as any)?.stdout || (tscErr as any)?.stderr || '';
        agentErrorCount = (agentErrors.match(/error TS/g) || []).length;
      }

      const newErrors = agentErrorCount - baselineErrorCount;
      if (newErrors > 0) {
        console.warn(`[lifecycle:${taskId.slice(0, 8)}] tsc: ${newErrors} NEW error(s) (agent: ${agentErrorCount}, baseline: ${baselineErrorCount})`);

        // Try to fix new errors with up to 3 rounds
        const MAX_TSC_FIX_ROUNDS = 3;
        for (let round = 0; round < MAX_TSC_FIX_ROUNDS; round++) {
          console.log(`[lifecycle:${taskId.slice(0, 8)}] Spawning fix agent for tsc errors (round ${round + 1}/${MAX_TSC_FIX_ROUNDS})`);
          try {
            const newErrorLines = agentErrors.split('\n').filter(l => l.includes('error TS')).slice(0, 20).join('\n');
            await runChangesAgent(taskId, worktreePath, task, agentEntry,
              `TypeScript compilation errors found. Fix ONLY the errors in files you changed:\n\n${newErrorLines}`,
              taskModel, effectiveRepoPath);
          } catch { /* fix agent failed */ }

          // Re-check
          try {
            execSync('npx', ['tsc', '--noEmit'], { cwd: worktreePath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000 });
            console.log(`[lifecycle:${taskId.slice(0, 8)}] tsc passed after fix round ${round + 1}`);
            agentErrorCount = 0;
            break;
          } catch (recheck: unknown) {
            agentErrors = (recheck as any)?.stdout || (recheck as any)?.stderr || '';
            agentErrorCount = (agentErrors.match(/error TS/g) || []).length;
            if (agentErrorCount <= baselineErrorCount) {
              console.log(`[lifecycle:${taskId.slice(0, 8)}] tsc: no new errors after fix round ${round + 1}`);
              break;
            }
          }
        }
      } else {
        console.log(`[lifecycle:${taskId.slice(0, 8)}] tsc: no new errors (baseline: ${baselineErrorCount}, agent: ${agentErrorCount})`);
      }
    }

    // 7. Generate and submit diff
    const diffContent = generateDiff(worktreePath, effectiveDefaultBranch, branchName);
    const diffStats = parseDiffStats(diffContent);

    if (!diffStats.diffContent.trim()) {
      console.error(`[lifecycle:${taskId.slice(0, 8)}] Agent produced no changes. Marking as errored.`);
      await api.updateTaskStatus(taskId, 'errored', 'Agent produced no code changes');
      return;
    }

    // Run code audit (summary + bug/security/testing check)
    const auditResult = await runCodeAudit(taskId, worktreePath, diffStats.diffContent, planFileManifest);
    if (auditResult) {
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Audit verdict: ${auditResult.audit.verdict}`);
      if (auditResult.audit.bugs.length > 0) {
        console.warn(`[lifecycle:${taskId.slice(0, 8)}] Audit found ${auditResult.audit.bugs.length} potential bug(s)`);
      }
      if (auditResult.audit.security.length > 0) {
        console.warn(`[lifecycle:${taskId.slice(0, 8)}] Audit found ${auditResult.audit.security.length} security concern(s)`);
      }
    }

    // Check plan compliance
    const compliance = checkPlanCompliance(planFileManifest, diffStats.filesChanged);
    if (!compliance.compliant) {
      console.warn(`[lifecycle:${taskId.slice(0, 8)}] Plan compliance drift: unexpected=${(compliance.unexpected as string[]).join(', ')}, missing=${(compliance.missing as string[]).join(', ')}`);
    }

    await api.submitDiff(taskId, {
      diff_content: diffStats.diffContent,
      files_changed: diffStats.filesChanged,
      additions: diffStats.totalAdditions,
      deletions: diffStats.totalDeletions,
      summary: auditResult?.summary || undefined,
      compliance,
      audit: auditResult?.audit || undefined,
    });
    console.log(
      `[lifecycle:${taskId.slice(0, 8)}] Diff submitted: +${diffStats.totalAdditions} -${diffStats.totalDeletions} across ${diffStats.filesChanged.length} file(s)`
    );

    // 8. Await review
    await api.updateTaskStatus(taskId, 'awaiting_review');

    // 8a. Start QA agent in background (runs in parallel with your review)
    const qaPromise = runQAAgent(taskId, worktreePath, diffStats.filesChanged.map(f => f.path))
      .then(async (testResults) => {
        await api.updateDiffTestResults(taskId, testResults as unknown as Record<string, unknown>);
        console.log(`[qa:${taskId.slice(0, 8)}] Tests: ${testResults.status} (${testResults.tests_passed}/${testResults.tests_written} passed, ${testResults.duration_ms}ms)`);
      })
      .catch(async (err) => {
        console.error(`[qa:${taskId.slice(0, 8)}] QA failed:`, err);
        await api.updateDiffTestResults(taskId, { status: 'failed', summary: 'QA agent crashed', failures: [String(err)] }).catch(() => {});
      });

    const reviewDecision = await waitForReviewDecision(taskId);

    // Wait for QA to finish before proceeding (worktree must be stable for merge)
    await qaPromise.catch(() => {});

    if (shuttingDown) return;

    // 8b. Review loop — supports multiple rounds of changes.
    // Round 0 handles the initial review decision; rounds 1..MAX_CHANGE_ROUNDS handle change requests.
    const MAX_CHANGE_ROUNDS = 3;
    let currentReviewDecision = reviewDecision;

    for (let changeRound = 0; changeRound < MAX_CHANGE_ROUNDS + 1; changeRound++) {
      if (shuttingDown) return;

      // Check if task was cancelled
      const currentTask = await api.getTask(taskId);
      if (currentTask.status === 'cancelled') {
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Task cancelled during review.`);
        return;
      }

      if (currentReviewDecision === 'approved') {
        // Merge — dashboard may have already transitioned to 'merging'
        const preMergeTask = await api.getTask(taskId);
        if (preMergeTask.status !== 'merging') {
          await api.updateTaskStatus(taskId, 'merging');
        }
        const mergeResult = mergeBranch(worktreePath, effectiveDefaultBranch, branchName);

        if (!mergeResult.success) {
          console.error(
            `[lifecycle:${taskId.slice(0, 8)}] Merge failed: ${mergeResult.error}`
          );
          await api.updateTaskStatus(taskId, 'errored', mergeResult.error);
          return;
        }

        const pushResult = pushBranch(worktreePath, effectiveDefaultBranch);
        if (!pushResult.success) {
          console.error(
            `[lifecycle:${taskId.slice(0, 8)}] Push failed: ${pushResult.error}`
          );
          await api.updateTaskStatus(taskId, 'errored', pushResult.error);
          return;
        }

        // Monitor deployment
        await api.updateTaskStatus(taskId, 'deploying');
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Pushed. Monitoring deploy...`);

        try {
          const deploySuccess = await waitForDeploy(taskId);
          if (deploySuccess) {
            await api.updateTaskStatus(taskId, 'completed');
            console.log(`[lifecycle:${taskId.slice(0, 8)}] Task completed — deployed!`);
          } else {
            await api.updateTaskStatus(taskId, 'errored', 'GitHub Actions deploy failed');
            console.error(`[lifecycle:${taskId.slice(0, 8)}] Deploy failed.`);
          }
        } catch (deployErr) {
          const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
          await api.updateTaskStatus(taskId, 'errored', msg);
          console.error(`[lifecycle:${taskId.slice(0, 8)}] Deploy error: ${msg}`);
        }
        return;
      } else if (currentReviewDecision === 'changes_requested') {
        if (changeRound >= MAX_CHANGE_ROUNDS) {
          console.log(`[lifecycle:${taskId.slice(0, 8)}] Max change rounds (${MAX_CHANGE_ROUNDS}) exceeded.`);
          await api.updateTaskStatus(taskId, 'errored', 'Max change request rounds exceeded');
          return;
        }

        console.log(`[lifecycle:${taskId.slice(0, 8)}] Changes requested (round ${changeRound + 1}/${MAX_CHANGE_ROUNDS}), re-executing...`);
        // Server may have already transitioned to 'executing' via the request-changes endpoint
        const preChangeTask = await api.getTask(taskId);
        if (preChangeTask.status !== 'executing') {
          await api.updateTaskStatus(taskId, 'executing');
        }

        // Fetch the actual review feedback
        let feedback = 'Please review and improve the code.';
        try {
          const retrieved = await api.getDiffFeedback(taskId);
          if (retrieved) feedback = retrieved;
        } catch (err) {
          console.warn(`[lifecycle:${taskId.slice(0, 8)}] Failed to fetch review feedback:`, err);
        }
        await runChangesAgent(taskId, worktreePath, task, agentEntry, feedback, taskModel, effectiveRepoPath);

        if (shuttingDown) return;

        // Re-generate diff
        const newDiffContent = generateDiff(worktreePath, effectiveDefaultBranch, branchName);
        const newDiffStats = parseDiffStats(newDiffContent);
        await api.submitDiff(taskId, {
          diff_content: newDiffStats.diffContent,
          files_changed: newDiffStats.filesChanged,
          additions: newDiffStats.totalAdditions,
          deletions: newDiffStats.totalDeletions,
        });

        await api.updateTaskStatus(taskId, 'awaiting_review');
        currentReviewDecision = await waitForReviewDecision(taskId);
        // Loop continues with new decision
      } else {
        // Rejected
        await api.updateTaskStatus(taskId, 'rejected');
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Task rejected.`);
        return;
      }
    }

    // If we exit the loop without returning, something went wrong
    console.error(`[lifecycle:${taskId.slice(0, 8)}] Review loop ended without resolution.`);
    await api.updateTaskStatus(taskId, 'errored', 'Review loop ended without resolution');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lifecycle:${taskId.slice(0, 8)}] Error: ${message}`);
    try {
      await api.updateTaskStatus(taskId, 'errored', message);
    } catch {
      console.error(`[lifecycle:${taskId.slice(0, 8)}] Failed to update task to errored state`);
    }
  } finally {
    // Cleanup
    activeAgents.delete(taskId);

    try {
      await api.releaseFileLocks(taskId);
    } catch {
      // Best effort
    }

    try {
      await api.releaseSlot(slotId);
    } catch {
      // Best effort
    }

    // Run workspace teardown
    try {
      const wsConfig = readWorkspaceConfig(effectiveRepoPath);
      await runTeardown(worktreePath, slotNumber, wsConfig);
    } catch (err) {
      console.error(`[lifecycle:${taskId.slice(0, 8)}] Teardown failed:`, err);
    }

    try {
      cleanupCheckpoints(worktreePath, taskId);
    } catch {
      // Best effort
    }

    try {
      cleanupWorktree(worktreePath, effectiveRepoPath, branchName, effectiveDefaultBranch);
    } catch (err) {
      console.error(`[lifecycle:${taskId.slice(0, 8)}] Cleanup error:`, err);
    }

    console.log(`[lifecycle:${taskId.slice(0, 8)}] Slot ${slotNumber} released.`);
  }
}

// ---- Agent Runners ----

function runPlanningAgent(
  taskId: string,
  worktreePath: string,
  prompt: string,
  model?: string
): Promise<ReturnType<typeof extractPlan>> {
  return new Promise((resolve, reject) => {
    const { process: proc, kill } = spawnAgent(worktreePath, prompt, model || config.defaultModel);

    const parser = new OutputParser(proc.stdout!);
    const monitor = new AgentMonitor(proc);

    // Track in active agents for shutdown
    const agent = activeAgents.get(taskId);
    if (agent) {
      agent.kill = kill;
    }

    monitor.start();

    parser.on('message', () => {
      monitor.onOutput();
    });

    parser.on('toolUse', () => {
      monitor.onOutput();
    });

    parser.on('error', (err: unknown) => {
      console.error(`[planning:${taskId.slice(0, 8)}] Agent error:`, err);
    });

    const finish = () => {
      monitor.stop();
      const text = parser.getCollectedText();
      console.log(`[planning:${taskId.slice(0, 8)}] Collected text (${text.length} chars): ${text.slice(0, 500)}`);
      const plan = extractPlan(text);
      if (!plan) {
        console.warn(`[planning:${taskId.slice(0, 8)}] Plan extraction failed. Full text:\n${text.slice(0, 2000)}`);
      }
      resolve(plan);
    };

    parser.on('complete', () => {
      finish();
    });

    proc.on('exit', (code: number | null) => {
      if (code === 0) {
        finish();
      } else {
        const text = parser.getCollectedText();
        const plan = extractPlan(text);
        if (plan) {
          resolve(plan);
        } else {
          reject(new Error(`Planning agent exited with code ${code}`));
        }
      }
    });

    monitor.on('stall', () => {
      console.warn(`[planning:${taskId.slice(0, 8)}] Agent stalled. Killing.`);
      kill();
      const text = parser.getCollectedText();
      const plan = extractPlan(text);
      resolve(plan);
    });

    monitor.on('crash', (info: { code: number | null; signal: string | null }) => {
      reject(
        new Error(
          `Planning agent crashed (code: ${info.code}, signal: ${info.signal})`
        )
      );
    });
  });
}

function runExecutionAgent(
  taskId: string,
  worktreePath: string,
  task: api.Task,
  agentEntry: ActiveAgent,
  planFileManifest: string[],
  model?: string,
  repoPath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const executionPrompt = buildExecutionPrompt(task, planFileManifest, repoPath);
    const { process: proc, kill } = spawnAgent(
      worktreePath,
      executionPrompt,
      model || config.defaultModel
    );

    agentEntry.kill = kill;

    const parser = new OutputParser(proc.stdout!);
    const monitor = new AgentMonitor(proc);
    let turnCount = 0;
    monitor.start();

    parser.on('message', () => {
      monitor.onOutput();
    });

    parser.on('toolUse', (toolName: string) => {
      monitor.onOutput();
      turnCount++;
      console.log(`[exec:${taskId.slice(0, 8)}] Tool use: ${toolName} (turn ${turnCount})`);
      // Checkpoint after each tool use
      const saved = createCheckpoint(worktreePath, taskId, turnCount);
      if (saved) {
        console.log(`[exec:${taskId.slice(0, 8)}] Checkpoint ${turnCount} saved`);
      }
    });

    parser.on('complete', () => {
      monitor.stop();
      resolve();
    });

    proc.on('exit', (code: number | null) => {
      monitor.stop();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Execution agent exited with code ${code}`));
      }
    });

    monitor.on('stall', () => {
      console.warn(`[exec:${taskId.slice(0, 8)}] Agent stalled. Killing.`);
      kill();
      resolve(); // Resolve anyway — we'll submit whatever diff exists
    });

    monitor.on('crash', (info: { code: number | null; signal: string | null }) => {
      reject(
        new Error(
          `Execution agent crashed (code: ${info.code}, signal: ${info.signal})`
        )
      );
    });
  });
}

function runChangesAgent(
  taskId: string,
  worktreePath: string,
  task: api.Task,
  agentEntry: ActiveAgent,
  feedback: string,
  model?: string,
  repoPath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const changesPrompt = buildChangesPrompt(task, feedback, repoPath);
    const { process: proc, kill } = spawnAgent(
      worktreePath,
      changesPrompt,
      model || config.defaultModel
    );

    agentEntry.kill = kill;

    const parser = new OutputParser(proc.stdout!);
    const monitor = new AgentMonitor(proc);
    monitor.start();

    parser.on('message', () => {
      monitor.onOutput();
    });

    parser.on('toolUse', () => {
      monitor.onOutput();
    });

    parser.on('complete', () => {
      monitor.stop();
      resolve();
    });

    proc.on('exit', (code: number | null) => {
      monitor.stop();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Changes agent exited with code ${code}`));
      }
    });

    monitor.on('stall', () => {
      kill();
      resolve();
    });

    monitor.on('crash', (info: { code: number | null; signal: string | null }) => {
      reject(
        new Error(
          `Changes agent crashed (code: ${info.code}, signal: ${info.signal})`
        )
      );
    });
  });
}

// ---- Prompt Builders ----

function buildPlanPrompt(task: api.Task, repoPath?: string): string {
  const effectiveRepoPath = repoPath ?? config.repoPath!;
  let claudeMdContent = '';
  const claudeMdPath = path.join(effectiveRepoPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    try {
      claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      // Ignore read errors
    }
  }

  const claudeMdSection = claudeMdContent
    ? `\n${claudeMdContent}\n`
    : '';

  return `You are an AI coding agent working on a task. Your working directory is a git worktree.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${claudeMdSection}
INSTRUCTIONS:
1. First, analyze the codebase and generate a PLAN. Output your plan using this exact format:

## Plan
[Your approach summary]

## Files to Modify
- path/to/file1.ts
- path/to/file2.ts

## Reasoning
[Why this approach]

## Estimate
[Number of files, approximate lines]

2. STOP after outputting the plan. Do not write any code yet. Wait for approval.`;
}

function buildRejectionPrompt(task: api.Task, feedback: string, repoPath?: string): string {
  const effectiveRepoPath = repoPath ?? config.repoPath!;
  let claudeMdContent = '';
  const claudeMdPath = path.join(effectiveRepoPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    try {
      claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      // Ignore read errors
    }
  }

  const claudeMdSection = claudeMdContent
    ? `\n${claudeMdContent}\n`
    : '';

  return `You are an AI coding agent working on a task. Your working directory is a git worktree.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${claudeMdSection}
PREVIOUS PLAN REJECTED. Feedback: ${feedback}

INSTRUCTIONS:
Generate a revised plan incorporating the feedback. Use this exact format:

## Plan
[Your approach summary]

## Files to Modify
- path/to/file1.ts
- path/to/file2.ts

## Reasoning
[Why this approach]

## Estimate
[Number of files, approximate lines]

STOP after outputting the plan. Do not write any code yet. Wait for approval.`;
}

function buildExecutionPrompt(task: api.Task, planFileManifest: string[], repoPath?: string): string {
  const effectiveRepoPath = repoPath ?? config.repoPath!;
  let claudeMdContent = '';
  const claudeMdPath = path.join(effectiveRepoPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    try {
      claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      // Ignore read errors
    }
  }

  const claudeMdSection = claudeMdContent
    ? `\n${claudeMdContent}\n`
    : '';

  const fileListSection = planFileManifest.length > 0
    ? `\nAPPROVED FILE MANIFEST (ONLY modify these files):\n${planFileManifest.map(f => `- ${f}`).join('\n')}\n`
    : '';

  return `You are an AI coding agent working on a task. Your working directory is a git worktree.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${claudeMdSection}
PLAN APPROVED. Proceed with implementation.
${fileListSection}
REQUIREMENTS:
1. Implement ALL changes described in the approved plan. Do not skip any planned files.
2. ONLY modify files listed in the approved file manifest. Do NOT touch any other files, even if you think they need changes. If a file is not in the manifest, leave it alone.
3. Do NOT revert, "clean up", or modify existing code that is unrelated to your task. The codebase may contain recent changes from other developers — do not touch them.
4. Commit your changes when done with a clear commit message.

Focus on clean, correct implementation. Tests will be handled separately by QA.`;
}

function buildChangesPrompt(task: api.Task, feedback: string, repoPath?: string): string {
  const effectiveRepoPath = repoPath ?? config.repoPath!;
  let claudeMdContent = '';
  const claudeMdPath = path.join(effectiveRepoPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    try {
      claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      // Ignore read errors
    }
  }

  const claudeMdSection = claudeMdContent
    ? `\n${claudeMdContent}\n`
    : '';

  return `You are an AI coding agent working on a task. Your working directory is a git worktree.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${claudeMdSection}
CHANGES REQUESTED. The reviewer has provided the following feedback on your code:

${feedback}

REQUIREMENTS:
1. Make the requested changes. Focus specifically on what the reviewer asked for.
2. Commit your changes when done.`;
}

// ---- Code Audit ----

interface AuditResult {
  summary: string;
  audit: {
    bugs: string[];
    security: string[];
    testing: string[];
    quality: string[];
    verdict: 'pass' | 'concerns' | 'fail';
  };
}

async function runCodeAudit(
  taskId: string,
  worktreePath: string,
  diffContent: string,
  planFileManifest: string[]
): Promise<AuditResult | null> {
  try {
    const maxDiffLength = 15000;
    const truncatedDiff = diffContent.length > maxDiffLength
      ? diffContent.slice(0, maxDiffLength) + '\n... (truncated)'
      : diffContent;

    const fileList = planFileManifest.length > 0
      ? `\nPlanned files: ${planFileManifest.join(', ')}`
      : '';

    const auditPrompt = `You are a senior code reviewer auditing a diff. Be thorough but concise.
${fileList}

\`\`\`diff
${truncatedDiff}
\`\`\`

Respond in this EXACT format (no other text):

## Summary
[2-4 bullet points: what changed, one line per file]

## Bugs
[List potential bugs, logic errors, off-by-one errors. Write "None found" if clean.]

## Security
[List security issues: injection, XSS, hardcoded secrets, unsafe operations. Write "None found" if clean.]

## Testing
[Are tests included? Are edge cases covered? What tests are missing?]

## Quality
[Code quality issues: naming, duplication, complexity, missing error handling.]

## Verdict
[One word: PASS, CONCERNS, or FAIL]`;

    return new Promise((resolve) => {
      // Use Sonnet for the audit — strong enough to catch real issues, fast enough to not block
      const { process: proc, kill } = spawnAgent(worktreePath, auditPrompt, 'claude-sonnet-4-20250514');
      const parser = new OutputParser(proc.stdout!);

      const timeout = setTimeout(() => {
        kill();
        resolve(null);
      }, 60_000); // 60s timeout for audit

      const finish = () => {
        clearTimeout(timeout);
        const text = parser.getCollectedText();
        if (!text) {
          resolve(null);
          return;
        }

        // Parse the structured audit response
        const result = parseAuditResponse(text);
        resolve(result);
      };

      parser.on('complete', finish);
      proc.on('exit', finish);
    });
  } catch (err) {
    console.warn(`[lifecycle:${taskId.slice(0, 8)}] Code audit failed:`, err);
    return null;
  }
}

function parseAuditResponse(text: string): AuditResult {
  const extractSection = (name: string): string => {
    const regex = new RegExp(`## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const parseBullets = (section: string): string[] => {
    if (!section || section.toLowerCase().includes('none found')) return [];
    return section
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('-') || l.startsWith('*'))
      .map(l => l.replace(/^[-*]\s*/, ''));
  };

  const summary = extractSection('Summary') || text.slice(0, 500);
  const bugs = parseBullets(extractSection('Bugs'));
  const security = parseBullets(extractSection('Security'));
  const testing = parseBullets(extractSection('Testing'));
  const quality = parseBullets(extractSection('Quality'));

  const verdictSection = extractSection('Verdict').toUpperCase();
  let verdict: 'pass' | 'concerns' | 'fail' = 'concerns';
  if (verdictSection.includes('PASS')) verdict = 'pass';
  else if (verdictSection.includes('FAIL')) verdict = 'fail';

  return {
    summary,
    audit: { bugs, security, testing, quality, verdict },
  };
}

// ---- QA Agent ----

interface TestResults {
  status: 'running' | 'passed' | 'failed' | 'skipped';
  tests_written: number;
  tests_passed: number;
  tests_failed: number;
  failures: string[];
  duration_ms: number;
  summary: string;
}

async function runQAAgent(
  taskId: string,
  worktreePath: string,
  filesChanged: string[]
): Promise<TestResults> {
  const startTime = Date.now();

  // Notify server that tests are running
  await api.updateDiffTestResults(taskId, { status: 'running', summary: 'QA agent starting...' });

  const fileList = filesChanged.map(f => `- ${f}`).join('\n');

  const qaPrompt = `You are a QA engineer. A developer just made changes to this codebase. Your working directory is a git worktree with the changes already committed.

FILES MODIFIED:
${fileList}

Your job:
1. Read the changed files to understand what was modified.
2. Write focused smoke tests for the changes. Target the specific functions/logic that changed.
3. Run the tests to verify they pass.
4. Commit the test files when done.

Guidelines:
- Write ONLY tests for the changed code, not the entire codebase.
- Keep tests focused: 3-5 test cases per changed function.
- Use the project's existing test framework if one exists. If not, use a simple approach.
- If tests fail, try to fix them once. If they still fail, commit them anyway and report the failures.
- Be fast. This is a smoke test, not a comprehensive test suite.
- Do NOT modify the implementation code — only add test files.`;

  try {
    return new Promise((resolve) => {
      const { process: proc, kill } = spawnAgent(worktreePath, qaPrompt, 'claude-opus-4-6');
      const parser = new OutputParser(proc.stdout!);

      const timeout = setTimeout(() => {
        kill();
        resolve({
          status: 'failed',
          tests_written: 0,
          tests_passed: 0,
          tests_failed: 0,
          failures: ['QA agent timed out after 120s'],
          duration_ms: Date.now() - startTime,
          summary: 'QA agent timed out',
        });
      }, 300_000); // 5 min timeout for QA

      const finish = () => {
        clearTimeout(timeout);
        const text = parser.getCollectedText();
        const results = parseQAResults(text, Date.now() - startTime);
        resolve(results);
      };

      parser.on('complete', finish);
      proc.on('exit', finish);
    });
  } catch (err) {
    return {
      status: 'failed',
      tests_written: 0,
      tests_passed: 0,
      tests_failed: 0,
      failures: [err instanceof Error ? err.message : String(err)],
      duration_ms: Date.now() - startTime,
      summary: 'QA agent crashed',
    };
  }
}

function parseQAResults(text: string, durationMs: number): TestResults {
  // Try to extract test counts from the agent's output
  const passMatch = text.match(/(\d+)\s+(?:test|spec)s?\s+passed/i);
  const failMatch = text.match(/(\d+)\s+(?:test|spec)s?\s+failed/i);
  const totalMatch = text.match(/(\d+)\s+(?:test|spec)s?\s+(?:total|written|created)/i);

  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
  const total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed;

  // Extract failure messages
  const failures: string[] = [];
  const failureSection = text.match(/(?:fail|error|FAIL).*?(?:\n.*?){0,3}/gi);
  if (failureSection) {
    for (const f of failureSection.slice(0, 5)) {
      failures.push(f.trim().slice(0, 200));
    }
  }

  const hasTests = total > 0 || text.toLowerCase().includes('test');
  const status: TestResults['status'] = !hasTests ? 'skipped'
    : failed > 0 ? 'failed'
    : 'passed';

  // Generate summary from agent output
  const summaryLines = text.split('\n').filter(l => l.trim()).slice(-5);
  const summary = summaryLines.join('\n').slice(0, 500) || 'Tests completed';

  return {
    status,
    tests_written: total || (hasTests ? 1 : 0),
    tests_passed: passed,
    tests_failed: failed,
    failures,
    duration_ms: durationMs,
    summary,
  };
}

// ---- Plan Compliance Check ----

function checkPlanCompliance(
  planFileManifest: string[],
  actualFilesChanged: { path: string }[]
): Record<string, unknown> {
  const normalizePath = (p: string) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  const planned = new Set(planFileManifest.map(normalizePath));
  const actual = new Set(actualFilesChanged.map(f => normalizePath(f.path)));

  const unexpected = [...actual].filter(f => !planned.has(f));
  const missing = [...planned].filter(f => !actual.has(f));

  return {
    planned: [...planned],
    actual: [...actual],
    unexpected,
    missing,
    compliant: unexpected.length === 0 && missing.length === 0,
  };
}

// ---- Deploy Monitor ----

async function waitForDeploy(taskId: string): Promise<boolean> {
  const { execFileSync } = await import('child_process');
  const DEPLOY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  const POLL_INTERVAL = 10_000; // 10 seconds
  const start = Date.now();

  // Wait a few seconds for GitHub Actions to pick up the push
  await new Promise(r => setTimeout(r, 5000));

  while (Date.now() - start < DEPLOY_TIMEOUT) {
    try {
      const output = execFileSync(
        'gh', ['api', 'repos/Pivot-Studio-AI/agent-pool/actions/runs', '--jq', '.workflow_runs[0] | {status, conclusion}'],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000 }
      ).trim();

      const run = JSON.parse(output);
      if (run.status === 'completed') {
        console.log(`[deploy:${taskId.slice(0, 8)}] GitHub Actions: ${run.conclusion}`);
        return run.conclusion === 'success';
      }
      console.log(`[deploy:${taskId.slice(0, 8)}] GitHub Actions: ${run.status}... (${Math.round((Date.now() - start) / 1000)}s)`);
    } catch (err) {
      console.warn(`[deploy:${taskId.slice(0, 8)}] Failed to check deploy status:`, err instanceof Error ? err.message : err);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error('Deploy timed out after 5 minutes');
}

// ---- Polling Helpers ----

interface PlanDecision {
  status: 'approved' | 'rejected';
  feedback?: string;
}

async function waitForPlanDecision(taskId: string): Promise<PlanDecision> {
  const pollInterval = 5000; // 5 seconds
  const maxWait = 24 * 60 * 60 * 1000; // 24 hours
  const startTime = Date.now();

  while (!shuttingDown && Date.now() - startTime < maxWait) {
    try {
      // Check for cancellation
      const task = await api.getTask(taskId);
      if (task.status === 'cancelled') {
        throw new Error('Task cancelled');
      }

      const plans = await api.getPlans(taskId);
      if (plans.length > 0) {
        const latest = plans[plans.length - 1];
        if (latest.status === 'approved') {
          return { status: 'approved' };
        }
        if (latest.status === 'rejected') {
          return {
            status: 'rejected',
            feedback: latest.reviewer_feedback || undefined,
          };
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Task cancelled') throw err;
      console.warn(`[waitForPlan:${taskId.slice(0, 8)}] Poll error:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timed out waiting for plan decision');
}

async function waitForReviewDecision(
  taskId: string
): Promise<'approved' | 'changes_requested' | 'rejected'> {
  const pollInterval = 5000;
  const maxWait = 24 * 60 * 60 * 1000;
  const startTime = Date.now();

  while (!shuttingDown && Date.now() - startTime < maxWait) {
    try {
      const task = await api.getTask(taskId);
      if (task.status === 'merging' || task.status === 'completed') {
        return 'approved';
      }
      if (task.status === 'executing') {
        return 'changes_requested';
      }
      if (task.status === 'rejected') {
        return 'rejected';
      }
      if (task.status === 'cancelled') {
        return 'rejected'; // Treat cancellation as rejection for flow purposes
      }
    } catch (err) {
      console.warn(`[waitForReview:${taskId.slice(0, 8)}] Poll error:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timed out waiting for review decision');
}

// ---- Start ----

main().catch((err) => {
  console.error('[daemon] Fatal error:', err);
  process.exit(1);
});
