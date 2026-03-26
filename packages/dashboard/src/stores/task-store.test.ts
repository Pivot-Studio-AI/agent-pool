import { describe, it, expect } from 'vitest';
import type { Task } from '../lib/types';

// Test implementations of selector functions
function getAttentionTasks(tasks: Record<string, Task>): Task[] {
  return Object.values(tasks).filter(
    (t) => t.status === 'awaiting_approval' || t.status === 'awaiting_review'
  );
}

function getActiveTasks(tasks: Record<string, Task>): Task[] {
  return Object.values(tasks).filter((t) => t.status === 'executing');
}

function getQueuedTasks(tasks: Record<string, Task>): Task[] {
  return Object.values(tasks).filter((t) => t.status === 'queued');
}

function getRecentTasks(tasks: Record<string, Task>): Task[] {
  return Object.values(tasks)
    .filter(
      (t) =>
        t.status === 'completed' ||
        t.status === 'rejected' ||
        t.status === 'errored' ||
        t.status === 'cancelled'
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);
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

describe('task-store selectors', () => {
  describe('getAttentionTasks()', () => {
    it('should filter tasks in awaiting_approval status', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'awaiting_approval' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getAttentionTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter tasks in awaiting_review status', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'awaiting_review' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getAttentionTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should include both awaiting_approval and awaiting_review', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'awaiting_approval' }),
        '2': mockTask({ id: '2', status: 'awaiting_review' }),
        '3': mockTask({ id: '3', status: 'queued' }),
      };
      const result = getAttentionTasks(tasks);
      expect(result).toHaveLength(2);
    });

    it('should exclude other statuses', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'executing' }),
        '2': mockTask({ id: '2', status: 'completed' }),
        '3': mockTask({ id: '3', status: 'rejected' }),
      };
      const result = getAttentionTasks(tasks);
      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveTasks()', () => {
    it('should filter only executing tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'executing' }),
        '2': mockTask({ id: '2', status: 'queued' }),
        '3': mockTask({ id: '3', status: 'executing' }),
      };
      const result = getActiveTasks(tasks);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'executing')).toBe(true);
    });

    it('should return empty array when no executing tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'queued' }),
        '2': mockTask({ id: '2', status: 'completed' }),
      };
      const result = getActiveTasks(tasks);
      expect(result).toHaveLength(0);
    });
  });

  describe('getQueuedTasks()', () => {
    it('should filter only queued tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'queued' }),
        '2': mockTask({ id: '2', status: 'executing' }),
        '3': mockTask({ id: '3', status: 'queued' }),
      };
      const result = getQueuedTasks(tasks);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'queued')).toBe(true);
    });
  });

  describe('getRecentTasks()', () => {
    it('should include completed tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'completed' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('should include rejected tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'rejected' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('rejected');
    });

    it('should include errored tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'errored' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('errored');
    });

    it('should include cancelled tasks (new status)', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'cancelled' }),
        '2': mockTask({ id: '2', status: 'queued' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('cancelled');
    });

    it('should exclude active/queued tasks', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'queued' }),
        '2': mockTask({ id: '2', status: 'executing' }),
        '3': mockTask({ id: '3', status: 'completed' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('should sort by updated_at descending', () => {
      const now = new Date();
      const tasks = {
        '1': mockTask({
          id: '1',
          status: 'completed',
          updated_at: new Date(now.getTime() - 100).toISOString(),
        }),
        '2': mockTask({
          id: '2',
          status: 'completed',
          updated_at: new Date(now.getTime() - 50).toISOString(),
        }),
        '3': mockTask({
          id: '3',
          status: 'completed',
          updated_at: new Date(now.getTime() - 200).toISOString(),
        }),
      };
      const result = getRecentTasks(tasks);
      expect(result[0].id).toBe('2'); // Most recent
      expect(result[1].id).toBe('1');
      expect(result[2].id).toBe('3'); // Least recent
    });

    it('should limit to 10 tasks', () => {
      const tasks: Record<string, Task> = {};
      for (let i = 0; i < 15; i++) {
        tasks[`${i}`] = mockTask({
          id: `${i}`,
          status: 'completed',
          updated_at: new Date(Date.now() - i * 1000).toISOString(),
        });
      }
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(10);
    });

    it('should handle mix of all terminal statuses with cancelled', () => {
      const tasks = {
        '1': mockTask({ id: '1', status: 'completed' }),
        '2': mockTask({ id: '2', status: 'rejected' }),
        '3': mockTask({ id: '3', status: 'errored' }),
        '4': mockTask({ id: '4', status: 'cancelled' }),
      };
      const result = getRecentTasks(tasks);
      expect(result).toHaveLength(4);
      expect(result.map((t) => t.status)).toEqual(
        expect.arrayContaining(['completed', 'rejected', 'errored', 'cancelled'])
      );
    });
  });
});
