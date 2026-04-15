import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf-8');

describe('globals.css', () => {
  it('should define dark theme CSS variables under :root', () => {
    expect(css).toContain(':root');
    expect(css).toContain('--color-bg');
    expect(css).toContain('--color-surface');
    expect(css).toContain('--color-accent');
    expect(css).toContain('--color-green');
    expect(css).toContain('--color-red');
  });

  it('should define light theme CSS variables under .light', () => {
    expect(css).toContain('.light');
    // Light theme should have different values than dark
    const lightSection = css.split('.light')[1]?.split('}')[0] ?? '';
    expect(lightSection).toContain('--color-bg');
    expect(lightSection).toContain('--color-surface');
  });

  it('should define fade-in animation', () => {
    expect(css).toContain('@keyframes fade-in');
    expect(css).toContain('.animate-fade-in');
  });

  it('should define pulse-subtle animation', () => {
    expect(css).toContain('@keyframes pulse-subtle');
    expect(css).toContain('.animate-pulse-subtle');
  });

  it('should include scrollbar styling', () => {
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('--scrollbar-thumb');
  });
});
