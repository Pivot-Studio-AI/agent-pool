import { describe, it, expect } from 'vitest';
import type { Task } from '../lib/types';

// Replicate the new selector functions from task-store.ts for testing
// (Cannot import directly due to zustand dependency not available at root)

interface TaskState {
  tasks: Record<string, Task>;
  testStatus: Record<string, string>;
}

function isTestsRunning(state: TaskState, taskId: string): boolean {
  return state.testStatus[taskId] === 'running';
}

function getAttentionTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter(
    (t) =>
      t.status === 'awaiting_approval' ||
      (t.status === 'awaiting_review' && !isTestsRunning(state, t.id))
  );
}

function getActiveTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter(
    (t) =>
      t.status === 'executing' ||
      t.status === 'planning' ||
      t.status === 'merging' ||
      t.status === 'deploying' ||
      (t.status === 'awaiting_review' && isTestsRunning(state, t.id))
  );
}

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-id',
  title: 'Test Task',
  description: 'Test Description',
  status: 'queued' as const,
  priority: 'medium' as const,
  model_tier: 'default',
  target_branch: 'main',
  parent_task_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
  ...overrides,
});

const makeState = (
  tasks: Record<string, Task>,
  testStatus: Record<string, string> = {}
): TaskState => ({ tasks, testStatus });

describe('isTestsRunning', () => {
  it('returns true when testStatus is "running"', () => {
    const state = makeState({}, { 'task-1': 'running' });
    expect(isTestsRunning(state, 'task-1')).toBe(true);
  });

  it('returns false when testStatus is "passed"', () => {
    const state = makeState({}, { 'task-1': 'passed' });
    expect(isTestsRunning(state, 'task-1')).toBe(false);
  });

  it('returns false when testStatus is "failed"', () => {
    const state = makeState({}, { 'task-1': 'failed' });
    expect(isTestsRunning(state, 'task-1')).toBe(false);
  });

  it('returns false when no testStatus entry exists', () => {
    const state = makeState({}, {});
    expect(isTestsRunning(state, 'task-1')).toBe(false);
  });
});

describe('getAttentionTasks with test status', () => {
  it('includes awaiting_review when tests are NOT running', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_review' }) };
    const state = makeState(tasks, { '1': 'passed' });
    expect(getAttentionTasks(state)).toHaveLength(1);
  });

  it('excludes awaiting_review when tests ARE running', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_review' }) };
    const state = makeState(tasks, { '1': 'running' });
    expect(getAttentionTasks(state)).toHaveLength(0);
  });

  it('still includes awaiting_approval regardless of test status', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_approval' }) };
    const state = makeState(tasks, {});
    expect(getAttentionTasks(state)).toHaveLength(1);
  });

  it('includes awaiting_review with no test status entry (defaults to not running)', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_review' }) };
    const state = makeState(tasks, {});
    expect(getAttentionTasks(state)).toHaveLength(1);
  });
});

describe('getActiveTasks with test status', () => {
  it('includes awaiting_review when tests ARE running', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_review' }) };
    const state = makeState(tasks, { '1': 'running' });
    const active = getActiveTasks(state);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('1');
  });

  it('excludes awaiting_review when tests are NOT running', () => {
    const tasks = { '1': mockTask({ id: '1', status: 'awaiting_review' }) };
    const state = makeState(tasks, { '1': 'passed' });
    expect(getActiveTasks(state)).toHaveLength(0);
  });

  it('still includes executing, planning, merging, deploying tasks', () => {
    const tasks = {
      '1': mockTask({ id: '1', status: 'executing' }),
      '2': mockTask({ id: '2', status: 'planning' }),
      '3': mockTask({ id: '3', status: 'merging' }),
      '4': mockTask({ id: '4', status: 'deploying' }),
    };
    const state = makeState(tasks, {});
    expect(getActiveTasks(state)).toHaveLength(4);
  });

  it('correctly categorizes mixed tasks with test statuses', () => {
    const tasks = {
      '1': mockTask({ id: '1', status: 'awaiting_review' }), // tests running -> active
      '2': mockTask({ id: '2', status: 'awaiting_review' }), // tests passed -> attention
      '3': mockTask({ id: '3', status: 'executing' }),        // always active
      '4': mockTask({ id: '4', status: 'awaiting_approval' }), // always attention
    };
    const state = makeState(tasks, { '1': 'running', '2': 'passed' });

    const active = getActiveTasks(state);
    const attention = getAttentionTasks(state);

    expect(active.map(t => t.id).sort()).toEqual(['1', '3']);
    expect(attention.map(t => t.id).sort()).toEqual(['2', '4']);
  });
});
