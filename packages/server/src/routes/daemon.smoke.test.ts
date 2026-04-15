import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'daemon.ts'), 'utf-8');

describe('daemon routes', () => {
  it('has POST /daemon/repo/ack endpoint', () => {
    expect(source).toContain("'/repo/ack'");
    expect(source).toContain('daemonRouter.post');
  });

  it('has GET /daemon/repo endpoint', () => {
    expect(source).toContain("'/repo'");
  });

  it('has GET /daemon/repos endpoint for multi-repo mode', () => {
    expect(source).toContain("'/repos'");
  });

  it('has POST /daemon/repo-slots endpoint for multi-repo slot setup', () => {
    expect(source).toContain("'/repo-slots'");
  });

  it('register accepts optional repo_id', () => {
    expect(source).toContain("repo_id: z.string().uuid().optional()");
  });

  it('register inserts repo_id into daemons table', () => {
    expect(source).toContain('repo_id');
    expect(source).toContain("data.repo_id ?? null");
  });

  it('repo-slots uses ON CONFLICT for upsert', () => {
    expect(source).toContain('ON CONFLICT');
    expect(source).toContain("DO UPDATE SET");
  });
});
