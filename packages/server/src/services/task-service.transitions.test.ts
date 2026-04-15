import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'task-service.ts'), 'utf-8');

describe('task-service state machine (full transitions)', () => {
  it('includes deploying status', () => {
    expect(source).toContain("'deploying'");
  });

  it('merging can transition to deploying', () => {
    expect(source).toMatch(/merging:.*'deploying'/);
  });

  it('deploying can transition to completed or errored', () => {
    expect(source).toMatch(/deploying:.*'completed'/);
    expect(source).toMatch(/deploying:.*'errored'/);
  });

  it('deploying does not allow cancelled transition', () => {
    // deploying: ['completed', 'errored'] — no cancelled
    const deployingLine = source.match(/deploying:\s*\[([^\]]*)\]/);
    expect(deployingLine).not.toBeNull();
    expect(deployingLine![1]).not.toContain('cancelled');
  });

  it('planning can transition to errored', () => {
    expect(source).toMatch(/planning:.*'errored'/);
  });

  it('has updateTaskDeploy function', () => {
    expect(source).toContain('updateTaskDeploy');
    expect(source).toContain('deploy_status');
    expect(source).toContain('deploy_url');
  });

  it('dispatches notifications for key transitions', () => {
    expect(source).toContain('dispatchNotification');
    expect(source).toContain('plan_ready');
    expect(source).toContain('review_ready');
    expect(source).toContain('merge_completed');
    expect(source).toContain('task_errored');
  });

  it('sets completed_at for terminal states', () => {
    expect(source).toContain('completed_at');
    expect(source).toContain('TERMINAL_STATES');
  });

  it('TERMINAL_STATES includes all four terminal states', () => {
    expect(source).toMatch(/TERMINAL_STATES.*completed/s);
    expect(source).toMatch(/TERMINAL_STATES.*errored/s);
    expect(source).toMatch(/TERMINAL_STATES.*rejected/s);
    expect(source).toMatch(/TERMINAL_STATES.*cancelled/s);
  });
});
