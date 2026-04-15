import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'tailwind.config.js'), 'utf-8');

describe('Tailwind config', () => {
  it('should define all color tokens', () => {
    const colors = ['bg', 'surface', 'surface-hover', 'surface-raised', 'border', 'border-subtle',
      'text-primary', 'text-secondary', 'text-muted', 'accent', 'accent-glow',
      'green', 'green-glow', 'amber', 'amber-glow', 'red', 'red-glow', 'purple', 'purple-glow'];
    for (const c of colors) {
      const hasKey = source.includes(`${c}:`) || source.includes(`'${c}':`);
      expect(hasKey, `Expected color token '${c}' to exist`).toBe(true);
    }
  });

  it('should define Inter and JetBrains Mono font families', () => {
    expect(source).toContain('Inter');
    expect(source).toContain('JetBrains Mono');
  });

  it('should NOT define glow/shadow utilities (removed in flat redesign)', () => {
    expect(source).not.toContain('glow-accent');
    expect(source).not.toContain('glow-green');
    expect(source).not.toContain('inner-glow');
    expect(source).not.toContain('elevated');
    expect(source).not.toContain('card-hover');
  });

  it('should set borderRadius none to 0px for sharp edges', () => {
    expect(source).toContain("'none': '0px'");
  });

  it('should support darkMode with class strategy', () => {
    expect(source).toContain("darkMode: 'class'");
  });
});
