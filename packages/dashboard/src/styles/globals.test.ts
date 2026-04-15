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
    const lightSection = css.split('.light')[1]?.split('}')[0] ?? '';
    expect(lightSection).toContain('--color-bg');
    expect(lightSection).toContain('--color-surface');
  });

  it('should define surface-raised and border-subtle variables', () => {
    expect(css).toContain('--color-surface-raised');
    expect(css).toContain('--color-border-subtle');
  });

  it('should define fade-in and slide-in-right animations', () => {
    expect(css).toContain('@keyframes fade-in');
    expect(css).toContain('.animate-fade-in');
    expect(css).toContain('@keyframes slide-in-right');
    expect(css).toContain('.animate-slide-in');
  });

  it('should define pulse-subtle animation', () => {
    expect(css).toContain('@keyframes pulse-subtle');
    expect(css).toContain('.animate-pulse-subtle');
  });

  it('should NOT define removed utilities (shimmer, glass, noise, gradient-text)', () => {
    expect(css).not.toContain('@keyframes shimmer');
    expect(css).not.toContain('.glass');
    expect(css).not.toContain('.text-gradient-accent');
    expect(css).not.toContain('.noise-bg');
    expect(css).not.toContain('@keyframes glow-pulse');
  });

  it('should use outline for focus instead of box-shadow glow', () => {
    expect(css).toContain('outline: 2px solid var(--color-accent)');
    expect(css).not.toContain('box-shadow: 0 0 0 3px var(--color-accent-glow)');
  });

  it('should use 120ms transition duration', () => {
    expect(css).toContain('transition-duration: 120ms');
    expect(css).not.toContain('transition-duration: 180ms');
  });

  it('should include scrollbar styling', () => {
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('--scrollbar-thumb');
  });
});
