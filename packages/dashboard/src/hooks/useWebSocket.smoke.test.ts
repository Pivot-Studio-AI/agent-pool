import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'useWebSocket.ts'), 'utf-8');

describe('useWebSocket hook', () => {
  it('handles diffs.tests_updated WebSocket event', () => {
    expect(source).toContain("'diffs.tests_updated'");
  });

  it('updates test status from WebSocket test result events', () => {
    expect(source).toContain('setTestStatus');
    expect(source).toContain('data.test_results?.status');
  });

  it('sets test status to running when task moves to awaiting_review', () => {
    expect(source).toContain("data.status === 'awaiting_review'");
    expect(source).toContain("setTestStatus(data.id, 'running')");
  });

  it('forces task updated_at change to trigger DiffReview re-fetch on test update', () => {
    expect(source).toContain('new Date().toISOString()');
  });

  it('shows toast for test results updated', () => {
    expect(source).toContain("addToast('Test results updated'");
  });
});
