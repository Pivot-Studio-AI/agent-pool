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

  it('should support sm and md sizes', () => {
    expect(source).toContain("sm:");
    expect(source).toContain("md:");
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
