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
import { spawnAgent, sendToAgent, killAgent } from './agent/spawner.js';
import { OutputParser } from './agent/output-parser.js';
import { extractPlan } from './agent/plan-extractor.js';
import { AgentMonitor } from './agent/monitor.js';
import { checkoutBranch, createBranch, pullLatest } from './git/branch.js';
import { generateDiff, parseDiffStats } from './git/diff.js';
import { mergeBranch, pushBranch } from './git/merge.js';
import { cleanupWorktree } from './worktree/cleanup.js';
import { ensureRepo } from './git/clone.js';

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
            await api.releaseSlot(agent.slotId);
          } catch {
            // Best effort
          }
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
            await api.releaseSlot(agent.slotId);
          } catch {
            // Best effort
          }
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
    // 1. Prepare worktree
    console.log(`[lifecycle:${taskId.slice(0, 8)}] Preparing worktree at ${worktreePath}`);
    try {
      checkoutBranch(worktreePath, effectiveDefaultBranch);
    } catch {
      // May already be on the right branch or in detached HEAD state
      console.warn(`[lifecycle:${taskId.slice(0, 8)}] Checkout default branch warning, continuing...`);
    }
    pullLatest(worktreePath);
    createBranch(worktreePath, branchName, effectiveDefaultBranch);

    // 2. Update task status to planning
    await api.updateTaskStatus(taskId, 'planning');

    // 3. Build the plan prompt
    const prompt = buildPlanPrompt(task, effectiveRepoPath);

    // 4. Run planning phase (may loop if plan is rejected)
    let approved = false;
    let planFileManifest: string[] = [];

    while (!approved && !shuttingDown) {
      // Spawn agent for planning
      const planResult = await runPlanningAgent(taskId, worktreePath, prompt);

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
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Plan submitted (${plan.id})`);

      // Update task to awaiting_approval
      await api.updateTaskStatus(taskId, 'awaiting_approval');

      // Poll for approval
      const decision = await waitForPlanDecision(taskId);

      if (decision.status === 'approved') {
        approved = true;
        planFileManifest = planResult.fileManifest;
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Plan approved!`);
      } else if (decision.status === 'rejected' && decision.feedback) {
        console.log(
          `[lifecycle:${taskId.slice(0, 8)}] Plan rejected. Feedback: ${decision.feedback}`
        );
        // Update task back to planning for another attempt
        await api.updateTaskStatus(taskId, 'planning');
        // The prompt will be rebuilt with rejection feedback on next loop iteration
        // Actually, we need to rebuild the prompt with rejection feedback
        const rejectionPrompt = buildRejectionPrompt(task, decision.feedback, effectiveRepoPath);
        // Override prompt for next iteration — we'll just recursively spawn
        const retryResult = await runPlanningAgent(taskId, worktreePath, rejectionPrompt);
        if (!retryResult) {
          throw new Error('Agent exited without producing a revised plan');
        }

        const retryPlan = await api.submitPlan(taskId, {
          content: retryResult.content,
          file_manifest: retryResult.fileManifest,
          reasoning: retryResult.reasoning,
          estimate: retryResult.estimate,
        });
        console.log(`[lifecycle:${taskId.slice(0, 8)}] Revised plan submitted (${retryPlan.id})`);
        await api.updateTaskStatus(taskId, 'awaiting_approval');

        const retryDecision = await waitForPlanDecision(taskId);
        if (retryDecision.status === 'approved') {
          approved = true;
          planFileManifest = retryResult.fileManifest;
        } else {
          // Permanently rejected
          await api.updateTaskStatus(taskId, 'rejected');
          return;
        }
      } else {
        // Permanently rejected (no feedback)
        await api.updateTaskStatus(taskId, 'rejected');
        return;
      }
    }

    if (shuttingDown) return;

    // 5. Acquire file locks
    if (planFileManifest.length > 0) {
      try {
        await api.acquireFileLocks(taskId, planFileManifest);
        console.log(
          `[lifecycle:${taskId.slice(0, 8)}] Acquired locks on ${planFileManifest.length} file(s)`
        );
      } catch (err) {
        console.warn(`[lifecycle:${taskId.slice(0, 8)}] Failed to acquire file locks:`, err);
      }
    }

    // 6. Execute implementation
    await api.updateTaskStatus(taskId, 'executing');
    await runExecutionAgent(taskId, worktreePath, task, agentEntry, effectiveRepoPath);

    if (shuttingDown) return;

    // 7. Generate and submit diff
    const diffContent = generateDiff(worktreePath, effectiveDefaultBranch, branchName);
    const diffStats = parseDiffStats(diffContent);

    await api.submitDiff(taskId, {
      diff_content: diffStats.diffContent,
      files_changed: diffStats.filesChanged,
      additions: diffStats.totalAdditions,
      deletions: diffStats.totalDeletions,
    });
    console.log(
      `[lifecycle:${taskId.slice(0, 8)}] Diff submitted: +${diffStats.totalAdditions} -${diffStats.totalDeletions} across ${diffStats.filesChanged.length} file(s)`
    );

    // 8. Await review
    await api.updateTaskStatus(taskId, 'awaiting_review');
    const reviewDecision = await waitForReviewDecision(taskId);

    if (shuttingDown) return;

    if (reviewDecision === 'approved') {
      // 9. Merge
      await api.updateTaskStatus(taskId, 'merging');
      const mergeResult = mergeBranch(worktreePath, effectiveDefaultBranch, branchName);

      if (!mergeResult.success) {
        console.error(
          `[lifecycle:${taskId.slice(0, 8)}] Merge failed: ${mergeResult.error}`
        );
        await api.updateTaskStatus(taskId, 'errored', mergeResult.error);
        return;
      }

      // Push
      const pushResult = pushBranch(worktreePath, effectiveDefaultBranch);
      if (!pushResult.success) {
        console.error(
          `[lifecycle:${taskId.slice(0, 8)}] Push failed: ${pushResult.error}`
        );
        await api.updateTaskStatus(taskId, 'errored', pushResult.error);
        return;
      }

      await api.updateTaskStatus(taskId, 'completed');
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Task completed and merged!`);
    } else if (reviewDecision === 'changes_requested') {
      // Re-spawn agent with change request feedback
      // For now, we'll handle a single round of changes
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Changes requested, re-executing...`);
      await api.updateTaskStatus(taskId, 'executing');

      // Fetch the latest review comments
      const latestTask = await api.getTask(taskId);
      await runChangesAgent(taskId, worktreePath, task, agentEntry, effectiveRepoPath);

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
      // After one round of changes, wait for final decision
      const finalDecision = await waitForReviewDecision(taskId);

      if (finalDecision === 'approved') {
        await api.updateTaskStatus(taskId, 'merging');
        const mergeResult = mergeBranch(worktreePath, effectiveDefaultBranch, branchName);
        if (mergeResult.success) {
          const pushResult = pushBranch(worktreePath, effectiveDefaultBranch);
          if (pushResult.success) {
            await api.updateTaskStatus(taskId, 'completed');
            console.log(`[lifecycle:${taskId.slice(0, 8)}] Task completed after changes!`);
          } else {
            await api.updateTaskStatus(taskId, 'errored', pushResult.error);
          }
        } else {
          await api.updateTaskStatus(taskId, 'errored', mergeResult.error);
        }
      } else {
        await api.updateTaskStatus(taskId, 'rejected');
      }
    } else {
      // Rejected
      await api.updateTaskStatus(taskId, 'rejected');
      console.log(`[lifecycle:${taskId.slice(0, 8)}] Task rejected.`);
    }
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
  prompt: string
): Promise<ReturnType<typeof extractPlan>> {
  return new Promise((resolve, reject) => {
    const { process: proc, kill } = spawnAgent(worktreePath, prompt, config.defaultModel);

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
      const plan = extractPlan(text);
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
  repoPath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const executionPrompt = buildExecutionPrompt(task, repoPath);
    const { process: proc, kill } = spawnAgent(
      worktreePath,
      executionPrompt,
      config.defaultModel
    );

    agentEntry.kill = kill;

    const parser = new OutputParser(proc.stdout!);
    const monitor = new AgentMonitor(proc);
    monitor.start();

    parser.on('message', () => {
      monitor.onOutput();
    });

    parser.on('toolUse', (toolName: string) => {
      monitor.onOutput();
      console.log(`[exec:${taskId.slice(0, 8)}] Tool use: ${toolName}`);
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
  repoPath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const changesPrompt = buildChangesPrompt(task, repoPath);
    const { process: proc, kill } = spawnAgent(
      worktreePath,
      changesPrompt,
      config.defaultModel
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

function buildExecutionPrompt(task: api.Task, repoPath?: string): string {
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
PLAN APPROVED. Proceed with implementation. Write the code now.

Make all the necessary changes to complete this task. Commit your changes when done.`;
}

function buildChangesPrompt(task: api.Task, repoPath?: string): string {
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
CHANGES REQUESTED. The following feedback was provided on your code:
Please review the existing changes and make the requested improvements.

Please make the requested changes. Commit your changes when done.`;
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
