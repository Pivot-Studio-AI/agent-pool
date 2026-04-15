import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Button.tsx'), 'utf-8');

describe('Button component', () => {
  it('should define all variant styles', () => {
    const variants = ['primary', 'success', 'danger', 'merge', 'default'];
    for (const v of variants) {
      expect(source).toContain(`${v}:`);
    }
  });

  it('should use flat bg colors instead of gradients for primary/success/merge', () => {
    expect(source).toContain('bg-accent text-white');
    expect(source).toContain('bg-green text-white');
    expect(source).toContain('bg-purple text-white');
    expect(source).not.toContain('bg-gradient-to-b');
  });

  it('should use border instead of ring for variant borders', () => {
    expect(source).toContain('border border-accent/50');
    expect(source).toContain('border border-green/50');
    expect(source).toContain('border border-purple/50');
    expect(source).not.toContain('ring-1 ring-accent');
    expect(source).not.toContain('shadow-inner-glow');
  });

  it('should support sm and md sizes', () => {
    expect(source).toContain('sm:');
    expect(source).toContain('md:');
  });

  it('should disable button when loading or disabled', () => {
    expect(source).toContain('disabled={disabled || loading}');
  });

  it('should use active:opacity instead of active:scale for press feedback', () => {
    expect(source).toContain('active:opacity-80');
    expect(source).not.toContain('active:scale');
  });
});
