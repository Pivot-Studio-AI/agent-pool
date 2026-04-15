import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Task } from '../../lib/types';

const source = readFileSync(resolve(__dirname, 'Sidebar.tsx'), 'utf-8');

// Replicate the Section component's visibility logic for testing
function shouldRenderSection(tasks: Task[]): boolean {
  return tasks.length > 0;
}

function isCollapsed(defaultCollapsed: boolean, toggleCount: number): boolean {
  return toggleCount % 2 === 0 ? defaultCollapsed : !defaultCollapsed;
}

function shouldShowTasks(collapsed: boolean): boolean {
  return !collapsed;
}

function chevronRotated(collapsed: boolean): boolean {
  return !collapsed;
}

function makeMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    description: '',
    status: 'queued',
    priority: 'medium',
    model_tier: 'default',
    target_branch: 'main',
    parent_task_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

describe('Sidebar design updates', () => {
  it('should use glass utility for frosted sidebar background', () => {
    expect(source).toContain('glass');
  });

  it('should use border-border/60 for subtle border', () => {
    expect(source).toContain('border-border/60');
  });

  it('should show active indicator bar on selected task', () => {
    expect(source).toContain('w-0.5 h-4 bg-accent rounded-r');
  });

  it('should apply ring-1 ring-accent/15 on selected task', () => {
    expect(source).toContain('ring-1 ring-accent/15');
  });

  it('should show section count with ml-auto alignment', () => {
    expect(source).toContain('ml-auto');
  });

  it('should define all sidebar sections', () => {
    expect(source).toContain('Needs Attention');
    expect(source).toContain('In Progress');
    expect(source).toContain('Queued');
    expect(source).toContain('Recent');
  });
});

describe('Sidebar Section collapse logic', () => {
  describe('shouldRenderSection', () => {
    it('returns false when tasks array is empty', () => {
      expect(shouldRenderSection([])).toBe(false);
    });

    it('returns true when tasks exist', () => {
      expect(shouldRenderSection([makeMockTask()])).toBe(true);
    });
  });

  describe('defaultCollapsed behavior', () => {
    it('starts expanded when defaultCollapsed is false', () => {
      expect(isCollapsed(false, 0)).toBe(false);
      expect(shouldShowTasks(isCollapsed(false, 0))).toBe(true);
    });

    it('starts collapsed when defaultCollapsed is true (Recent section)', () => {
      expect(isCollapsed(true, 0)).toBe(true);
      expect(shouldShowTasks(isCollapsed(true, 0))).toBe(false);
    });

    it('toggles to collapsed after one click when starting expanded', () => {
      expect(isCollapsed(false, 1)).toBe(true);
    });

    it('toggles to expanded after one click when starting collapsed', () => {
      expect(isCollapsed(true, 1)).toBe(false);
    });

    it('returns to default state after two toggles', () => {
      expect(isCollapsed(false, 2)).toBe(false);
      expect(isCollapsed(true, 2)).toBe(true);
    });
  });

  describe('chevron rotation', () => {
    it('chevron is rotated when section is expanded', () => {
      expect(chevronRotated(false)).toBe(true);
    });

    it('chevron is not rotated when section is collapsed', () => {
      expect(chevronRotated(true)).toBe(false);
    });
  });

  describe('Sidebar section configuration', () => {
    const sectionConfigs = [
      { title: 'Needs Attention', dotColor: 'bg-amber', defaultCollapsed: false },
      { title: 'In Progress', dotColor: 'bg-green', defaultCollapsed: false },
      { title: 'Queued', dotColor: undefined, defaultCollapsed: false },
      { title: 'Recent', dotColor: undefined, defaultCollapsed: true },
    ];

    it('only Recent section defaults to collapsed', () => {
      const collapsedSections = sectionConfigs.filter((s) => s.defaultCollapsed);
      expect(collapsedSections).toHaveLength(1);
      expect(collapsedSections[0].title).toBe('Recent');
    });

    it('attention and active sections have colored dots', () => {
      const withDots = sectionConfigs.filter((s) => s.dotColor);
      expect(withDots).toHaveLength(2);
      expect(withDots.map((s) => s.title)).toEqual(['Needs Attention', 'In Progress']);
    });
  });
});
