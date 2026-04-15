import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'TaskDetail.tsx'), 'utf-8');

describe('TaskDetail component', () => {
  it('handles deploying status in switch', () => {
    expect(source).toContain("case 'deploying':");
    expect(source).toContain('DeployingView');
  });

  it('handles cancelled status in terminal view', () => {
    expect(source).toContain("case 'cancelled':");
  });

  it('has a CancelButton component', () => {
    expect(source).toContain('function CancelButton');
    expect(source).toContain('/cancel');
  });

  it('has a RetryButton component', () => {
    expect(source).toContain('function RetryButton');
    expect(source).toContain('/retry');
  });

  it('defines cancellable statuses correctly', () => {
    expect(source).toContain("'queued'");
    expect(source).toContain("'planning'");
    expect(source).toContain("'awaiting_approval'");
    expect(source).toContain("'executing'");
    expect(source).toContain("'awaiting_review'");
    expect(source).toContain("'merging'");
  });

  it('defines retryable statuses correctly', () => {
    expect(source).toContain("'errored'");
    expect(source).toContain("'cancelled'");
    expect(source).toContain("'rejected'");
  });

  it('shows repo and branch at top of TaskMetadata', () => {
    expect(source).toContain('BookOpen');
    expect(source).toContain('GitBranch');
    expect(source).toContain('repoName');
    expect(source).toContain('task.target_branch');
  });

  it('shows deploy status indicator for completed tasks', () => {
    expect(source).toContain('DeployStatusIndicator');
    expect(source).toContain('deploy_status');
    expect(source).toContain('deploy_url');
  });
});
