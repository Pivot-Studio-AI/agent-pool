import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'TaskStatusBadge.tsx'), 'utf-8');

describe('TaskStatusBadge tests-running support', () => {
  it('imports isTestsRunning from task-store', () => {
    expect(source).toContain("import { isTestsRunning } from '../../stores/task-store'");
  });

  it('accepts taskId prop', () => {
    expect(source).toContain('taskId?: string');
  });

  it('calls isTestsRunning with taskId', () => {
    expect(source).toContain('isTestsRunning(store, taskId)');
  });

  it('overrides config to Tests Running when awaiting_review and tests running', () => {
    expect(source).toContain("status === 'awaiting_review' && testsRunning");
    expect(source).toContain("label: 'Tests Running'");
  });

  it('uses accent color for Tests Running status', () => {
    // The tests-running override should use accent color
    expect(source).toContain("{ color: 'accent', label: 'Tests Running' }");
  });
});
