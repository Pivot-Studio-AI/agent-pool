import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readmePath = resolve(__dirname, '../../../README.md');
const readme = readFileSync(readmePath, 'utf-8');

describe('README.md smoke tests', () => {
  it('exists and is non-empty', () => {
    expect(readme.length).toBeGreaterThan(0);
  });

  it('has the correct project title', () => {
    expect(readme).toMatch(/^# Agent Pool/m);
  });

  it('documents all four architecture components', () => {
    expect(readme).toContain('Daemon');
    expect(readme).toContain('Server');
    expect(readme).toContain('Dashboard');
    expect(readme).toContain('Messaging');
  });

  it('includes setup instructions with required commands', () => {
    expect(readme).toContain('npm install');
    expect(readme).toContain('docker compose up');
    expect(readme).toContain('.env');
  });

  it('lists prerequisites', () => {
    expect(readme).toContain('Node.js');
    expect(readme).toContain('Docker');
    expect(readme).toContain('Claude Code CLI');
  });
});
