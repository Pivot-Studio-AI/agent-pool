import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'globals.css'), 'utf-8');

describe('globals.css dark/light theme', () => {
  it('defines dark theme as default on :root, .dark', () => {
    expect(source).toContain(':root, .dark');
  });

  it('defines light theme on .light class', () => {
    expect(source).toContain('.light');
  });

  it('has all required CSS custom properties for dark theme', () => {
    const requiredVars = [
      '--color-bg', '--color-surface', '--color-surface-hover', '--color-surface-raised',
      '--color-border', '--color-border-subtle', '--color-text-primary', '--color-text-secondary',
      '--color-text-muted', '--color-accent', '--color-green', '--color-amber', '--color-red', '--color-purple',
    ];
    for (const v of requiredVars) {
      expect(source).toContain(v);
    }
  });

  it('defines glow variants for accent, green, amber, red, purple', () => {
    expect(source).toContain('--color-accent-glow');
    expect(source).toContain('--color-green-glow');
    expect(source).toContain('--color-red-glow');
    expect(source).toContain('--color-purple-glow');
  });

  it('has scrollbar custom properties', () => {
    expect(source).toContain('--scrollbar-thumb');
    expect(source).toContain('--scrollbar-thumb-hover');
  });

  it('defines keyframes for animations', () => {
    expect(source).toContain('@keyframes pulse-subtle');
    expect(source).toContain('@keyframes fade-in');
    expect(source).toContain('@keyframes slide-in-right');
  });

  it('uses Inter font family instead of JetBrains Mono for body', () => {
    expect(source).toContain("'Inter'");
  });
});
