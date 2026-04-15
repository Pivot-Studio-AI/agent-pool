import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Badge.tsx'), 'utf-8');

describe('Badge component', () => {
  it('should define a colorMap with all expected colors', () => {
    const expectedColors = ['accent', 'green', 'amber', 'red', 'purple', 'text-muted', 'text-secondary'];
    for (const color of expectedColors) {
      // Keys may or may not be quoted depending on whether they contain hyphens
      const hasKey = source.includes(`${color}:`) || source.includes(`'${color}':`);
      expect(hasKey).toBe(true);
    }
  });

  it('should fall back to text-secondary for unknown colors', () => {
    expect(source).toContain("colorMap['text-secondary']");
  });

  it('should use clsx for className composition', () => {
    expect(source).toContain("import { clsx } from 'clsx'");
    expect(source).toContain('clsx(');
  });

  it('should accept className prop for customization', () => {
    expect(source).toContain('className?: string');
    expect(source).toContain('className');
  });
});
