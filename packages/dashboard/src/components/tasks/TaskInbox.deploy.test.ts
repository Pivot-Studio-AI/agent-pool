import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'TaskInbox.tsx'), 'utf-8');

describe('TaskInbox DeployBadge', () => {
  it('defines DeployBadge component', () => {
    expect(source).toContain('function DeployBadge');
  });

  it('returns null when no deploy_status', () => {
    expect(source).toContain('if (!task.deploy_status) return null');
  });

  it('shows Rocket icon for success', () => {
    expect(source).toContain("if (task.deploy_status === 'success')");
    expect(source).toContain('<Rocket');
  });

  it('shows XCircle icon for failed', () => {
    expect(source).toContain("if (task.deploy_status === 'failed')");
  });

  it('shows spinning Loader for pending', () => {
    expect(source).toContain("if (task.deploy_status === 'pending')");
    expect(source).toContain('animate-spin');
  });

  it('includes aria-labels for accessibility', () => {
    expect(source).toContain('aria-label="Deploy succeeded"');
    expect(source).toContain('aria-label="Deploy failed"');
    expect(source).toContain('aria-label="Deploying..."');
  });
});

describe('TaskInbox passes deployStatus to TaskStatusBadge', () => {
  it('passes deploy_status prop to TaskStatusBadge', () => {
    expect(source).toContain('deployStatus={task.deploy_status}');
  });
});
