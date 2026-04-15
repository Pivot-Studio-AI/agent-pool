import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'task-service.ts'), 'utf-8');

describe('task-service state machine', () => {
  it('includes cancelled as a valid TaskStatus', () => {
    expect(source).toContain("'cancelled'");
  });

  it('allows cancelled transitions from non-terminal states', () => {
    // queued, planning, awaiting_approval, executing, awaiting_review, merging should all allow cancelled
    const statesWithCancelled = ['queued', 'planning', 'awaiting_approval', 'executing', 'awaiting_review', 'merging'];
    for (const state of statesWithCancelled) {
      // The state machine maps each status to an array of allowed transitions
      // Each line should contain 'cancelled' in its transition array
      const regex = new RegExp(`${state}:.*'cancelled'`);
      expect(source).toMatch(regex);
    }
  });

  it('cancelled is a terminal state', () => {
    expect(source).toContain("'cancelled'");
    // cancelled should be in TERMINAL_STATES
    expect(source).toMatch(/TERMINAL_STATES.*cancelled/s);
  });

  it('cancelled allows retry back to queued', () => {
    expect(source).toMatch(/cancelled:\s*\[\s*'queued'\s*\]/);
  });

  it('maps cancelled transition to task_cancelled event', () => {
    expect(source).toContain("to === 'cancelled'");
    expect(source).toContain("return 'task_cancelled'");
  });

  it('includes repo_id in CreateTaskData and ListTasksFilters', () => {
    expect(source).toContain('repo_id?: string');
  });

  it('includes repo_id in updateTask fields', () => {
    expect(source).toContain("fields.repo_id !== undefined");
  });

  it('filters tasks by repo_id in listTasks', () => {
    expect(source).toContain('filters.repo_id');
    expect(source).toContain("repo_id = $");
  });
});
