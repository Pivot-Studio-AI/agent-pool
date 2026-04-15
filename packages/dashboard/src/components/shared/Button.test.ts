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

  it('should use gradient backgrounds for primary/success/merge variants', () => {
    expect(source).toContain('bg-gradient-to-b from-accent to-accent/90');
    expect(source).toContain('bg-gradient-to-b from-green to-green/90');
    expect(source).toContain('bg-gradient-to-b from-purple to-purple/90');
  });

  it('should add ring-1 borders to primary/success/merge variants', () => {
    expect(source).toContain('ring-1 ring-accent/30');
    expect(source).toContain('ring-1 ring-green/30');
    expect(source).toContain('ring-1 ring-purple/30');
  });

  it('should use shadow-inner-glow on default variant', () => {
    expect(source).toContain('shadow-inner-glow');
  });

  it('should support sm and md sizes', () => {
    expect(source).toContain('sm:');
    expect(source).toContain('md:');
  });

  it('should disable button when loading or disabled', () => {
    expect(source).toContain('disabled={disabled || loading}');
  });

  it('should show a spinner when loading', () => {
    expect(source).toContain('animate-spin');
    expect(source).toContain('{loading && (');
  });

  it('should apply active:scale transform for press feedback', () => {
    expect(source).toContain('active:scale-[0.97]');
  });
});
