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

  it('should define fade-in animation', () => {
    expect(css).toContain('@keyframes fade-in');
    expect(css).toContain('.animate-fade-in');
  });

  it('should define pulse-subtle animation', () => {
    expect(css).toContain('@keyframes pulse-subtle');
    expect(css).toContain('.animate-pulse-subtle');
  });

  it('should define shimmer animation', () => {
    expect(css).toContain('@keyframes shimmer');
    expect(css).toContain('.animate-shimmer');
  });

  it('should define glow-pulse animation', () => {
    expect(css).toContain('@keyframes glow-pulse');
  });

  it('should define glass morphism utility', () => {
    expect(css).toContain('.glass');
    expect(css).toContain('backdrop-filter: blur(16px)');
    expect(css).toContain('saturate(1.2)');
  });

  it('should define text-gradient-accent utility', () => {
    expect(css).toContain('.text-gradient-accent');
    expect(css).toContain('background-clip: text');
  });

  it('should define noise-bg utility', () => {
    expect(css).toContain('.noise-bg::before');
    expect(css).toContain('feTurbulence');
  });

  it('should include scrollbar styling', () => {
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('--scrollbar-thumb');
  });

  it('should apply smooth transitions on interactive elements', () => {
    expect(css).toContain('button, a, input, select, textarea');
    expect(css).toContain('transition-duration: 180ms');
  });
});
