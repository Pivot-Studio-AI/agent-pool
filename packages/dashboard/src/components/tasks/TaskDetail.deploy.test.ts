import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'TaskDetail.tsx'), 'utf-8');

describe('DeployingView', () => {
  it('renders deploying label and subtitle', () => {
    expect(source).toContain('Deploying to production...');
    expect(source).toContain('Monitoring GitHub Actions deploy');
  });

  it('renders deploy_url link when available', () => {
    expect(source).toContain('task.deploy_url ?');
    expect(source).toContain('View deployment');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});

describe('DeployStatusIndicator', () => {
  it('returns null when no deploy_status', () => {
    expect(source).toContain('if (!task.deploy_status) return null');
  });

  it('maps deploy_status to labels', () => {
    expect(source).toContain("task.deploy_status === 'success' ? 'Deployed'");
    expect(source).toContain("task.deploy_status === 'failed' ? 'Deploy Failed'");
    expect(source).toContain("task.deploy_status === 'pending' ? 'Deploying...'");
  });

  it('maps deploy_status to colors', () => {
    expect(source).toContain("task.deploy_status === 'success' ? 'text-green'");
    expect(source).toContain("task.deploy_status === 'failed' ? 'text-red'");
    expect(source).toContain("task.deploy_status === 'pending' ? 'text-amber'");
  });

  it('renders deploy_url as external link', () => {
    expect(source).toContain('task.deploy_url && (');
    expect(source).toContain('View deployment');
  });

  it('is used in CompletedView', () => {
    expect(source).toContain('<DeployStatusIndicator task={task} />');
  });
});

describe('TaskDetail deploy_status in Task type', () => {
  const typesSource = readFileSync(resolve(__dirname, '../../lib/types.ts'), 'utf-8');

  it('Task interface has deploy_status field', () => {
    expect(typesSource).toContain('deploy_status?: string | null');
  });

  it('Task interface has deploy_url field', () => {
    expect(typesSource).toContain('deploy_url?: string | null');
  });

  it('TaskStatus includes deploying', () => {
    expect(typesSource).toContain("'deploying'");
  });
});
