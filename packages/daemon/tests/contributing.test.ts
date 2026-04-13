import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const contributingPath = resolve(__dirname, '../../../CONTRIBUTING.md');
const contributing = readFileSync(contributingPath, 'utf-8');

describe('CONTRIBUTING.md smoke tests', () => {
  it('exists and is non-empty', () => {
    expect(contributing.length).toBeGreaterThan(0);
  });

  it('has the correct title', () => {
    expect(contributing).toMatch(/^# Contributing to Agent Pool/m);
  });

  it('includes getting started setup instructions', () => {
    expect(contributing).toContain('npm install');
    expect(contributing).toContain('docker compose up');
    expect(contributing).toContain('.env.example');
    expect(contributing).toContain('npm run migrate');
  });

  it('documents the three-package project structure', () => {
    expect(contributing).toContain('packages/server');
    expect(contributing).toContain('packages/dashboard');
    expect(contributing).toContain('packages/daemon');
  });

  it('covers development workflow and code style guidelines', () => {
    expect(contributing).toMatch(/## Development Workflow/);
    expect(contributing).toMatch(/## Code Style/);
    expect(contributing).toMatch(/## Commit Messages/);
    expect(contributing).toMatch(/## Pull Requests/);
  });
});
