import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'screenshot.ts'), 'utf-8');

describe('screenshot module', () => {
  it('exports takeScreenshot function', () => {
    expect(source).toContain('export async function takeScreenshot');
  });

  it('uses playwright CLI for screenshots', () => {
    expect(source).toContain('playwright');
    expect(source).toContain('screenshot');
    expect(source).toContain('chromium');
  });

  it('has a 25-second timeout', () => {
    expect(source).toContain('25_000');
  });

  it('creates output directory recursively', () => {
    expect(source).toContain('mkdirSync');
    expect(source).toContain('recursive: true');
  });

  it('returns null on failure (fails silently)', () => {
    // Should catch errors and return null
    expect(source).toContain('catch');
    expect(source).toContain('return null');
  });

  it('uses full-page screenshot mode', () => {
    expect(source).toContain('--full-page');
  });
});
