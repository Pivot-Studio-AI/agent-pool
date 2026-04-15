import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Card.tsx'), 'utf-8');

describe('Card component', () => {
  it('should use rounded-xl and shadow-card by default', () => {
    expect(source).toContain('rounded-xl');
    expect(source).toContain('shadow-card');
  });

  it('should apply ring-1 ring-white/[0.03] for subtle border', () => {
    expect(source).toContain('ring-1 ring-white/[0.03]');
  });

  it('should support hover prop with translate effect', () => {
    expect(source).toContain("hover?: boolean");
    expect(source).toContain('shadow-card-hover');
    expect(source).toContain('hover:-translate-y-px');
  });

  it('should increase ring opacity on hover', () => {
    expect(source).toContain('hover:ring-white/[0.06]');
  });

  it('should default hover to false', () => {
    expect(source).toContain('hover = false');
  });

  it('should use bg-surface as base background', () => {
    expect(source).toContain('bg-surface');
  });
});
