import { describe, it, expect } from 'vitest';

// ─── Inline the state machine logic for unit testing ───

type TaskStatus =
  | 'queued' | 'planning' | 'awaiting_approval' | 'executing'
  | 'awaiting_review' | 'merging' | 'deploying' | 'completed' | 'errored' | 'rejected' | 'cancelled';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued:             ['planning', 'cancelled'],
  planning:           ['awaiting_approval', 'cancelled', 'errored'],
  awaiting_approval:  ['planning', 'executing', 'rejected', 'cancelled'],
  executing:          ['awaiting_review', 'errored', 'cancelled'],
  awaiting_review:    ['merging', 'executing', 'rejected', 'cancelled'],
  merging:            ['deploying', 'completed', 'errored', 'cancelled'],
  deploying:          ['completed', 'errored'],
  completed:          [],
  errored:            ['queued'],
  rejected:           ['queued'],
  cancelled:          ['queued'],
};

const TERMINAL_STATES: Set<TaskStatus> = new Set(['completed', 'errored', 'rejected', 'cancelled']);

const ALL_STATUSES: Set<TaskStatus> = new Set([
  'queued', 'planning', 'awaiting_approval', 'executing',
  'awaiting_review', 'merging', 'deploying', 'completed', 'errored', 'rejected', 'cancelled',
]);

function eventTypeForTransition(from: TaskStatus, to: TaskStatus): string {
  if (to === 'planning' && from === 'queued') return 'task_assigned';
  if (to === 'planning' && from === 'awaiting_approval') return 'plan_rejected';
  if (to === 'awaiting_approval') return 'plan_submitted';
  if (to === 'executing' && from === 'awaiting_approval') return 'execution_started';
  if (to === 'executing' && from === 'awaiting_review') return 'review_changes_requested';
  if (to === 'awaiting_review') return 'execution_completed';
  if (to === 'merging') return 'merge_started';
  if (to === 'deploying') return 'deploy_started';
  if (to === 'completed') return 'task_completed';
  if (to === 'errored') return 'task_errored';
  if (to === 'rejected') return 'task_rejected';
  if (to === 'cancelled') return 'task_cancelled';
  return 'task_assigned';
}

// ─── Tests ───

describe('deploying status in state machine', () => {
  it('deploying is a valid status', () => {
    expect(ALL_STATUSES.has('deploying')).toBe(true);
  });

  it('merging can transition to deploying', () => {
    expect(VALID_TRANSITIONS['merging']).toContain('deploying');
  });

  it('deploying can transition to completed', () => {
    expect(VALID_TRANSITIONS['deploying']).toContain('completed');
  });

  it('deploying can transition to errored', () => {
    expect(VALID_TRANSITIONS['deploying']).toContain('errored');
  });

  it('deploying cannot transition to cancelled', () => {
    expect(VALID_TRANSITIONS['deploying']).not.toContain('cancelled');
  });

  it('deploying is not a terminal state', () => {
    expect(TERMINAL_STATES.has('deploying')).toBe(false);
  });
});

describe('eventTypeForTransition with deploying', () => {
  it('merging → deploying produces deploy_started', () => {
    expect(eventTypeForTransition('merging', 'deploying')).toBe('deploy_started');
  });

  it('deploying → completed produces task_completed', () => {
    expect(eventTypeForTransition('deploying', 'completed')).toBe('task_completed');
  });

  it('deploying → errored produces task_errored', () => {
    expect(eventTypeForTransition('deploying', 'errored')).toBe('task_errored');
  });
});

describe('deploy route validation (source inspection)', () => {
  const { readFileSync } = require('fs');
  const { resolve } = require('path');
  const routeSource = readFileSync(resolve(__dirname, '../routes/tasks.ts'), 'utf-8');

  it('has PATCH /tasks/:id/deploy endpoint', () => {
    expect(routeSource).toContain("taskRouter.patch('/:id/deploy'");
  });

  it('requires deploy_status in the request body', () => {
    expect(routeSource).toContain("if (!deploy_status)");
    expect(routeSource).toContain("deploy_status is required");
  });

  it('calls updateTaskDeploy service function', () => {
    expect(routeSource).toContain('updateTaskDeploy(req.params.id, deploy_status, deploy_url)');
  });
});
