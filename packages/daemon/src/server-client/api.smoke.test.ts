import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'api.ts'), 'utf-8');

describe('daemon API client', () => {
  it('exports repoId helper function', () => {
    expect(source).toContain('export function repoId');
  });

  it('repoId prefers repo_id over id', () => {
    expect(source).toContain('repo.repo_id ?? repo.id');
  });

  it('repoId throws when no id available', () => {
    expect(source).toContain('has no id');
  });

  it('exports getAllRepos for multi-repo mode', () => {
    expect(source).toContain('export async function getAllRepos');
    expect(source).toContain("'/daemon/repos'");
  });

  it('exports ensureRepoSlots for multi-repo slot setup', () => {
    expect(source).toContain('export async function ensureRepoSlots');
    expect(source).toContain("'/daemon/repo-slots'");
  });

  it('getQueuedTasks accepts optional repoId filter', () => {
    expect(source).toContain('getQueuedTasks(repoId?: string)');
    expect(source).toContain('repo_id=');
  });

  it('getIdleSlots accepts optional repoId filter', () => {
    expect(source).toContain('getIdleSlots(repoId?: string)');
  });

  it('exports ackRepo function', () => {
    expect(source).toContain('export async function ackRepo');
    expect(source).toContain("'/daemon/repo/ack'");
  });

  it('ackRepo is non-fatal (catches errors)', () => {
    expect(source).toContain('non-fatal');
  });

  it('exports cancelTask and retryTask', () => {
    expect(source).toContain('export async function cancelTask');
    expect(source).toContain('export async function retryTask');
  });

  it('has Repo interface with optional id/repo_id fields', () => {
    expect(source).toContain('interface Repo');
    expect(source).toContain('repo_id?: string');
  });
});
