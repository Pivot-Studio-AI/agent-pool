#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from './api-client.js';
import { readFileSync, appendFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env from monorepo root
dotenvConfig({ path: resolve(import.meta.dirname ?? '.', '../../../.env') });

const SERVER_URL = process.env.SERVER_URL ?? process.env.POOL_SERVER_URL ?? 'http://localhost:3100';
const API_KEY = process.env.API_KEY ?? process.env.POOL_API_KEY ?? '';

const api = new ApiClient({ serverUrl: SERVER_URL, apiKey: API_KEY });

const program = new Command();
program
  .name('pool')
  .description('Agent Pool CLI — manage multi-agent worktree orchestration')
  .version('0.1.0');

// ---- Tasks ----

const tasks = program.command('tasks').description('Manage tasks');

tasks
  .command('list')
  .alias('ls')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (opts) => {
    try {
      const taskList = await api.listTasks(opts.status);
      if (!taskList.length) {
        console.log(chalk.dim('No tasks found.'));
        return;
      }
      console.log(formatTaskTable(taskList));
    } catch (err) {
      error(err);
    }
  });

tasks
  .command('create <title>')
  .description('Create a new task')
  .option('-d, --description <desc>', 'Task description')
  .option('-p, --priority <priority>', 'Priority (low|medium|high|critical)', 'medium')
  .action(async (title, opts) => {
    try {
      const task = await api.createTask(title, opts.description, opts.priority);
      console.log(chalk.green('✓') + ` Task created: ${task.id.slice(0, 8)}`);
      console.log(`  Title: ${task.title}`);
      console.log(`  Status: ${colorStatus(task.status)}`);
    } catch (err) {
      error(err);
    }
  });

tasks
  .command('show <id>')
  .description('Show task details')
  .action(async (id) => {
    try {
      const task = await api.getTask(resolveId(id));
      console.log(formatTaskDetail(task as unknown as Record<string, unknown>));
    } catch (err) {
      error(err);
    }
  });

// ---- Approve / Reject ----

program
  .command('approve <task-id>')
  .description('Approve a pending plan or merge')
  .action(async (taskId) => {
    try {
      const id = resolveId(taskId);
      const task = await api.getTask(id);

      if (task.status === 'awaiting_approval') {
        const plans = await api.getPlans(id);
        const pending = plans.find((p) => p.status === 'pending');
        if (!pending) {
          console.log(chalk.yellow('No pending plan to approve.'));
          return;
        }
        console.log(chalk.dim('Plan:'));
        console.log(pending.content);
        console.log(chalk.dim('\nFiles: ') + pending.file_manifest.join(', '));
        const approved = await api.approvePlan(id, pending.id);
        console.log(chalk.green('✓') + ' Plan approved.');
      } else if (task.status === 'awaiting_review') {
        const approved = await api.approveMerge(id);
        console.log(chalk.green('✓') + ' Merge approved.');
      } else {
        console.log(chalk.yellow(`Task is in '${task.status}' state — nothing to approve.`));
      }
    } catch (err) {
      error(err);
    }
  });

program
  .command('reject <task-id>')
  .description('Reject a pending plan or merge')
  .option('-m, --message <reason>', 'Rejection reason')
  .action(async (taskId, opts) => {
    try {
      const id = resolveId(taskId);
      const task = await api.getTask(id);
      const reason = opts.message ?? 'Rejected via CLI';

      if (task.status === 'awaiting_approval') {
        const plans = await api.getPlans(id);
        const pending = plans.find((p) => p.status === 'pending');
        if (!pending) {
          console.log(chalk.yellow('No pending plan to reject.'));
          return;
        }
        await api.rejectPlan(id, pending.id, reason);
        console.log(chalk.red('✗') + ' Plan rejected.');
      } else if (task.status === 'awaiting_review') {
        await api.rejectMerge(id);
        console.log(chalk.red('✗') + ' Merge rejected.');
      } else {
        console.log(chalk.yellow(`Task is in '${task.status}' state — nothing to reject.`));
      }
    } catch (err) {
      error(err);
    }
  });

program
  .command('changes <task-id>')
  .description('Request changes on a diff')
  .requiredOption('-m, --message <comments>', 'Change request comments')
  .action(async (taskId, opts) => {
    try {
      await api.requestChanges(resolveId(taskId), opts.message);
      console.log(chalk.yellow('↻') + ' Changes requested.');
    } catch (err) {
      error(err);
    }
  });

// ---- Cancel / Retry ----

program
  .command('cancel <task-id>')
  .description('Cancel a task')
  .action(async (taskId) => {
    try {
      await api.cancelTask(resolveId(taskId));
      console.log(chalk.red('✗') + ' Task cancelled.');
    } catch (err) {
      error(err);
    }
  });

program
  .command('retry <task-id>')
  .description('Retry a failed/cancelled task')
  .action(async (taskId) => {
    try {
      await api.retryTask(resolveId(taskId));
      console.log(chalk.green('↻') + ' Task re-queued.');
    } catch (err) {
      error(err);
    }
  });

// ---- Status ----

program
  .command('status')
  .description('Show pool status — slots, tasks, activity')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const [slots, taskList, events] = await Promise.all([
        api.listSlots(),
        api.listTasks(),
        api.listEvents(10),
      ]);

      if (opts.json) {
        console.log(JSON.stringify({ slots, tasks: taskList, events }, null, 2));
        return;
      }

      // Slots
      console.log(chalk.bold('\n  Slots'));
      console.log(chalk.dim('  ' + '─'.repeat(60)));
      for (const slot of slots.sort((a, b) => a.slot_number - b.slot_number)) {
        const status = colorStatus(slot.status);
        const task = slot.current_task_id
          ? taskList.find((t) => t.id === slot.current_task_id)
          : null;
        const info = task ? chalk.dim(` → ${task.title.slice(0, 40)}`) : '';
        console.log(`  ${chalk.bold(`#${slot.slot_number}`)} ${status}${info}`);
      }

      // Active tasks
      const active = taskList.filter((t) => !['completed', 'errored', 'rejected', 'cancelled'].includes(t.status));
      if (active.length) {
        console.log(chalk.bold('\n  Active Tasks'));
        console.log(chalk.dim('  ' + '─'.repeat(60)));
        for (const t of active) {
          console.log(`  ${chalk.dim(t.id.slice(0, 8))} ${colorStatus(t.status)} ${t.title.slice(0, 50)}`);
        }
      }

      // Recent activity
      if (events.length) {
        console.log(chalk.bold('\n  Recent Activity'));
        console.log(chalk.dim('  ' + '─'.repeat(60)));
        for (const e of events.slice(0, 5)) {
          const time = new Date(e.created_at).toLocaleTimeString();
          console.log(`  ${chalk.dim(time)} ${e.event_type}`);
        }
      }

      console.log('');
    } catch (err) {
      error(err);
    }
  });

// ---- Diff ----

program
  .command('diff <task-id>')
  .description('Show the latest diff for a task')
  .action(async (taskId) => {
    try {
      const diffs = await api.getDiffs(resolveId(taskId));
      if (!diffs.length) {
        console.log(chalk.dim('No diffs yet.'));
        return;
      }
      const latest = diffs[diffs.length - 1];
      console.log(chalk.bold(`Diff: +${latest.additions} -${latest.deletions}`));
      if (latest.audit?.verdict) {
        console.log(chalk.dim(`Audit: ${latest.audit.verdict}`));
      }
      console.log('');
      console.log(latest.diff_content);
    } catch (err) {
      error(err);
    }
  });

// ---- Broadcast ----

program
  .command('broadcast <message>')
  .description('Append a message to the shared broadcast log')
  .action(async (message) => {
    // Write to local .broadcast file in the pool directory
    const poolDir = process.env.POOL_DIR ?? process.cwd();
    const broadcastFile = resolve(poolDir, '.broadcast');
    const timestamp = new Date().toISOString();
    const line = `${timestamp} [cli] ${message}\n`;
    appendFileSync(broadcastFile, line);
    console.log(chalk.green('✓') + ' Broadcast sent.');
  });

// ---- Shell Init ----

program
  .command('shell-init')
  .description('Output shell function for .zshrc/.bashrc')
  .option('--name <name>', 'Function name', 'pool')
  .action((opts) => {
    const name = opts.name;
    console.log(`# Agent Pool shell integration`);
    console.log(`# Add to your .zshrc: eval "$(pool shell-init)"`);
    console.log(`${name}() { npx --yes @agent-pool/cli "$@"; }`);
  });

// ---- Quick start ----

program
  .command('start [task]')
  .description('Create a task and let the daemon pick it up')
  .option('-p, --priority <priority>', 'Priority', 'high')
  .action(async (task, opts) => {
    if (!task) {
      console.log(chalk.yellow('Usage: pool start "description of work"'));
      return;
    }
    try {
      const created = await api.createTask(task, task, opts.priority);
      console.log(chalk.green('✓') + ` Task queued: ${created.id.slice(0, 8)} — "${task}"`);
      console.log(chalk.dim('  Daemon will pick this up automatically.'));
    } catch (err) {
      error(err);
    }
  });

// Default: show status if no command given
program.action(async () => {
  await program.commands.find((c) => c.name() === 'status')?.parseAsync(['', '', ...process.argv.slice(2)]);
});

program.parse();

// ---- Helpers ----

function resolveId(input: string): string {
  // Accept full UUID or short prefix (8+ chars)
  return input;
}

function colorStatus(status: string): string {
  const colors: Record<string, (s: string) => string> = {
    queued: chalk.gray,
    planning: chalk.cyan,
    awaiting_approval: chalk.yellow,
    executing: chalk.blue,
    awaiting_review: chalk.yellow,
    merging: chalk.magenta,
    deploying: chalk.magenta,
    completed: chalk.green,
    errored: chalk.red,
    rejected: chalk.red,
    cancelled: chalk.dim,
    idle: chalk.gray,
    claimed: chalk.blue,
  };
  const fn = colors[status] ?? chalk.white;
  return fn(status);
}

function formatTaskTable(tasks: { id: string; title: string; status: string; priority: string }[]): string {
  const lines = tasks.map((t) => {
    return `  ${chalk.dim(t.id.slice(0, 8))} ${colorStatus(t.status).padEnd(25)} ${chalk.dim(t.priority.padEnd(8))} ${t.title.slice(0, 50)}`;
  });
  return chalk.bold('\n  Tasks\n') + chalk.dim('  ' + '─'.repeat(60)) + '\n' + lines.join('\n') + '\n';
}

function formatTaskDetail(task: Record<string, unknown>): string {
  return Object.entries(task)
    .map(([k, v]) => `  ${chalk.dim(k)}: ${v}`)
    .join('\n');
}

function error(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(chalk.red('Error:') + ' ' + msg);
  process.exit(1);
}
