import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'MergeControls.tsx'), 'utf-8');

describe('MergeControls component', () => {
  it('accepts testStatus prop', () => {
    expect(source).toContain("testStatus?: 'running' | 'passed' | 'failed' | 'skipped' | null");
  });

  it('shows different merge button text based on test status', () => {
    expect(source).toContain("testsRunning ? 'Tests Running...'");
    expect(source).toContain("testsFailed ? 'Merge Anyway'");
    expect(source).toContain("'Approve & Merge'");
  });

  it('uses textarea with improved contrast styling', () => {
    expect(source).toContain('text-text-primary');
    expect(source).toContain('placeholder:text-text-secondary');
  });

  it('has request changes toggle behavior', () => {
    expect(source).toContain('showComments');
    expect(source).toContain("'Submit Changes'");
    expect(source).toContain("'Request Changes'");
  });
});
