import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Badge.tsx'), 'utf-8');

describe('Badge component', () => {
  it('should define a colorMap with all expected colors including border property', () => {
    const expectedColors = ['accent', 'green', 'amber', 'red', 'purple', 'text-muted', 'text-secondary'];
    for (const color of expectedColors) {
      const hasKey = source.includes(`${color}:`) || source.includes(`'${color}':`);
      expect(hasKey).toBe(true);
    }
  });

  it('should include border property in colorMap entries instead of ring', () => {
    expect(source).toContain('border:');
    expect(source).toContain('border-accent/25');
    expect(source).toContain('border-green/25');
    expect(source).toContain('border-red/25');
    expect(source).not.toContain('ring:');
    expect(source).not.toContain('ring-1');
  });

  it('should apply border base class instead of ring-1', () => {
    expect(source).toContain("'inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border'");
    expect(source).toContain('mapped.border');
    expect(source).not.toContain('mapped.ring');
  });

  it('should use text-[10px] font size and tracking-wider', () => {
    expect(source).toContain('text-[10px]');
    expect(source).toContain('tracking-wider');
  });

  it('should fall back to text-secondary for unknown colors', () => {
    expect(source).toContain("colorMap['text-secondary']");
  });
});
