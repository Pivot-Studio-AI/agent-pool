import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Card.tsx'), 'utf-8');

describe('Card component', () => {
  it('should use border instead of shadow-card and ring', () => {
    expect(source).toContain('bg-surface border border-border p-5');
    expect(source).not.toContain('shadow-card');
    expect(source).not.toContain('ring-1');
    expect(source).not.toContain('rounded-xl');
  });

  it('should support hover prop with bg change instead of translate', () => {
    expect(source).toContain("hover?: boolean");
    expect(source).toContain('hover:bg-surface-hover');
    expect(source).toContain('hover:border-text-muted/30');
    expect(source).not.toContain('hover:-translate-y-px');
  });

  it('should default hover to false', () => {
    expect(source).toContain('hover = false');
  });

  it('should use bg-surface as base background', () => {
    expect(source).toContain('bg-surface');
  });
});
