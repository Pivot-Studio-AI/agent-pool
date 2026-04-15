import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'types.ts'), 'utf-8');

describe('types definitions', () => {
  it('includes cancelled in TaskStatus', () => {
    expect(source).toContain("'cancelled'");
    expect(source).toMatch(/TaskStatus\s*=.*'cancelled'/);
  });

  it('includes deploying in TaskStatus', () => {
    expect(source).toContain("'deploying'");
  });

  it('includes task_cancelled in EventType', () => {
    expect(source).toContain("'task_cancelled'");
  });

  it('includes repo_id in Task interface', () => {
    expect(source).toContain('repo_id: string | null');
  });

  it('includes deploy fields in Task interface', () => {
    expect(source).toContain('deploy_status');
    expect(source).toContain('deploy_url');
  });

  it('includes test_results in Diff interface', () => {
    expect(source).toContain('test_results');
    expect(source).toContain("'running' | 'passed' | 'failed' | 'skipped'");
  });

  it('includes audit in Diff interface', () => {
    expect(source).toContain('audit');
    expect(source).toContain("'pass' | 'concerns' | 'fail'");
  });

  it('includes Repository and GithubRepo types', () => {
    expect(source).toContain('interface Repository');
    expect(source).toContain('interface GithubRepo');
  });
});
