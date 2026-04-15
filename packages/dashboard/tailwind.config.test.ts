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
      // Keys may be unquoted (bg:) or quoted ('surface-hover':)
      const hasKey = source.includes(`${c}:`) || source.includes(`'${c}':`);
      expect(hasKey, `Expected color token '${c}' to exist`).toBe(true);
    }
  });

  it('should define Inter and JetBrains Mono font families', () => {
    expect(source).toContain('Inter');
    expect(source).toContain('JetBrains Mono');
  });

  it('should define glow box shadows', () => {
    expect(source).toContain('glow-accent');
    expect(source).toContain('glow-green');
    expect(source).toContain('glow-amber');
    expect(source).toContain('glow-red');
    expect(source).toContain('glow-purple');
  });

  it('should define inner-glow shadow', () => {
    expect(source).toContain('inner-glow');
  });

  it('should define elevated shadow', () => {
    expect(source).toContain('elevated');
  });

  it('should support darkMode with class strategy', () => {
    expect(source).toContain("darkMode: 'class'");
  });
});
