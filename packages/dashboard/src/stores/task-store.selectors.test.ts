import { describe, it, expect } from 'vitest';
import type { Task } from '../lib/types';

// Replicate selector logic from task-store.ts for unit testing

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

describe('task-store selectors (tests-running aware)', () => {
  describe('isTestsRunning()', () => {
    it('returns true when testStatus is running', () => {
      const state: TaskState = { tasks: {}, testStatus: { 'task-1': 'running' } };
      expect(isTestsRunning(state, 'task-1')).toBe(true);
    });

    it('returns false when testStatus is passed', () => {
      const state: TaskState = { tasks: {}, testStatus: { 'task-1': 'passed' } };
      expect(isTestsRunning(state, 'task-1')).toBe(false);
    });

    it('returns false when no testStatus entry exists', () => {
      const state: TaskState = { tasks: {}, testStatus: {} };
      expect(isTestsRunning(state, 'task-1')).toBe(false);
    });
  });

  describe('getAttentionTasks() with test status', () => {
    it('excludes awaiting_review tasks with running tests', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_review' }),
        },
        testStatus: { '1': 'running' },
      };
      expect(getAttentionTasks(state)).toHaveLength(0);
    });

    it('includes awaiting_review tasks with passed tests', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_review' }),
        },
        testStatus: { '1': 'passed' },
      };
      expect(getAttentionTasks(state)).toHaveLength(1);
    });

    it('includes awaiting_review tasks with no test status', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_review' }),
        },
        testStatus: {},
      };
      expect(getAttentionTasks(state)).toHaveLength(1);
    });

    it('always includes awaiting_approval regardless of test status', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_approval' }),
        },
        testStatus: {},
      };
      expect(getAttentionTasks(state)).toHaveLength(1);
    });
  });

  describe('getActiveTasks() with test status', () => {
    it('includes awaiting_review tasks with running tests', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_review' }),
        },
        testStatus: { '1': 'running' },
      };
      expect(getActiveTasks(state)).toHaveLength(1);
    });

    it('excludes awaiting_review tasks without running tests', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'awaiting_review' }),
        },
        testStatus: { '1': 'passed' },
      };
      expect(getActiveTasks(state)).toHaveLength(0);
    });

    it('includes planning, merging, and deploying statuses', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'planning' }),
          '2': mockTask({ id: '2', status: 'merging' }),
          '3': mockTask({ id: '3', status: 'deploying' }),
          '4': mockTask({ id: '4', status: 'executing' }),
        },
        testStatus: {},
      };
      expect(getActiveTasks(state)).toHaveLength(4);
    });

    it('excludes queued and completed tasks', () => {
      const state: TaskState = {
        tasks: {
          '1': mockTask({ id: '1', status: 'queued' }),
          '2': mockTask({ id: '2', status: 'completed' }),
        },
        testStatus: {},
      };
      expect(getActiveTasks(state)).toHaveLength(0);
    });
  });
});
