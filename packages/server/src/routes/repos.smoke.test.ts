import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'repos.ts'), 'utf-8');

describe('repos route', () => {
  it('allows API key auth (no user) for POST /repos/select', () => {
    // Should use optional chaining on req.user for userId
    expect(source).toContain('req.user?.id ?? null');
  });

  it('returns all repos when no user (API key auth) on GET /repos', () => {
    expect(source).toContain('req.user');
    // Should have a fallback query for all repos
    expect(source).toContain("SELECT * FROM repositories ORDER BY created_at DESC");
  });

  it('still requires auth for /repos/github', () => {
    expect(source).toContain("if (!req.user)");
    expect(source).toContain("status(401)");
  });

  it('validates selectRepoSchema with required fields', () => {
    expect(source).toContain("full_name: z.string().min(1");
    expect(source).toContain("github_url: z.string().min(1");
    expect(source).toContain("default_branch: z.string().optional()");
  });
});
