import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'DiffReview.tsx'), 'utf-8');

describe('DiffReview component', () => {
  it('renders compliance badges for plan drift', () => {
    expect(source).toContain('Plan drift');
    expect(source).toContain('Matches plan');
  });

  it('parses compliance data with type safety', () => {
    expect(source).toContain('diff.compliance');
    expect(source).toContain('compliant');
    expect(source).toContain('unexpected');
    expect(source).toContain('missing');
  });

  it('renders agent summary section', () => {
    expect(source).toContain('diff.summary');
    expect(source).toContain('Agent Summary');
  });

  it('renders code audit report', () => {
    expect(source).toContain('diff.audit');
    expect(source).toContain('Code Audit');
    expect(source).toContain('audit.bugs');
    expect(source).toContain('audit.security');
  });

  it('renders test results section', () => {
    expect(source).toContain('diff.test_results');
    expect(source).toContain('test_results.status');
    expect(source).toContain("'running'");
    expect(source).toContain("'passed'");
    expect(source).toContain("'failed'");
    expect(source).toContain("'skipped'");
  });

  it('passes testStatus to MergeControls', () => {
    expect(source).toContain("testStatus={diff.test_results?.status ?? null}");
  });

  it('uses animate-fade-in for entry animation', () => {
    expect(source).toContain('animate-fade-in');
  });
});
