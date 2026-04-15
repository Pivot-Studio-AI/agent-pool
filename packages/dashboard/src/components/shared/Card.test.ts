import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Card.tsx'), 'utf-8');

describe('Card component', () => {
  it('should use rounded-xl and shadow-card by default', () => {
    expect(source).toContain('rounded-xl');
    expect(source).toContain('shadow-card');
  });

  it('should support hover prop for hover effects', () => {
    expect(source).toContain("hover?: boolean");
    expect(source).toContain('shadow-card-hover');
  });

  it('should default hover to false', () => {
    expect(source).toContain('hover = false');
  });

  it('should use bg-surface as base background', () => {
    expect(source).toContain('bg-surface');
  });
});
