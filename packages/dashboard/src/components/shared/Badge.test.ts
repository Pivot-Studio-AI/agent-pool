import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Badge.tsx'), 'utf-8');

describe('Badge component', () => {
  it('should define a colorMap with all expected colors including ring property', () => {
    const expectedColors = ['accent', 'green', 'amber', 'red', 'purple', 'text-muted', 'text-secondary'];
    for (const color of expectedColors) {
      const hasKey = source.includes(`${color}:`) || source.includes(`'${color}':`);
      expect(hasKey).toBe(true);
    }
  });

  it('should include ring property in colorMap entries', () => {
    expect(source).toContain('ring:');
    expect(source).toContain('ring-accent/20');
    expect(source).toContain('ring-green/20');
    expect(source).toContain('ring-red/20');
  });

  it('should apply ring-1 base class for subtle borders', () => {
    expect(source).toContain('ring-1');
    expect(source).toContain('mapped.ring');
  });

  it('should use text-[10px] font size and tracking-wider', () => {
    expect(source).toContain('text-[10px]');
    expect(source).toContain('tracking-wider');
  });

  it('should fall back to text-secondary for unknown colors', () => {
    expect(source).toContain("colorMap['text-secondary']");
  });

  it('should use clsx for className composition', () => {
    expect(source).toContain("import { clsx } from 'clsx'");
    expect(source).toContain('clsx(');
  });
});
