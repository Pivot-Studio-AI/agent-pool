import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'daemon.ts'), 'utf-8');

describe('daemon routes — recover endpoint', () => {
  it('has POST /recover endpoint', () => {
    expect(source).toContain("'/recover'");
    expect(source).toContain('.post');
  });

  it('resets executing and planning tasks to queued', () => {
    expect(source).toContain("SET status = 'queued'");
    expect(source).toContain("'executing'");
    expect(source).toContain("'planning'");
  });

  it('excludes tasks with active slots from recovery', () => {
    expect(source).toContain('NOT IN');
    expect(source).toContain('current_task_id');
    expect(source).toContain("('claimed', 'active')");
  });

  it('supports optional repo_id filter', () => {
    expect(source).toContain('repo_id');
    expect(source).toContain('$1::uuid IS NULL');
  });

  it('returns recovered count', () => {
    expect(source).toContain('recovered');
    expect(source).toContain('result.rowCount');
  });
});

describe('daemon routes — repo-slots endpoint', () => {
  it('has POST /repo-slots endpoint', () => {
    expect(source).toContain("'/repo-slots'");
  });

  it('preserves active/claimed slot status on upsert', () => {
    expect(source).toContain("WHEN slots.status IN ('claimed', 'active')");
    expect(source).toContain('ON CONFLICT');
  });

  it('accepts repo_id, pool_size, and base_path', () => {
    expect(source).toContain('repo_id');
    expect(source).toContain('pool_size');
    expect(source).toContain('base_path');
  });
});

describe('daemon routes — repo/ack endpoint', () => {
  it('has POST /repo/ack endpoint', () => {
    expect(source).toContain("'/repo/ack'");
  });

  it('updates daemon repo_id and repo_path', () => {
    expect(source).toContain('UPDATE daemons');
    expect(source).toContain('repo_id');
    expect(source).toContain('repo_path');
  });
});
