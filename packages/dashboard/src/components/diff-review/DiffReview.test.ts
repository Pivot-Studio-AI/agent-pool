import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Smoke tests for DiffReview layout changes.
 * The action buttons (MergeControls) were moved from the bottom of the page
 * to the top, immediately after the header. These tests verify that structural
 * invariant by reading the source file.
 */

const source = readFileSync(
  resolve(__dirname, 'DiffReview.tsx'),
  'utf-8'
);

describe('DiffReview layout structure', () => {
  it('renders MergeControls with border-b (top placement)', () => {
    expect(source).toContain('border-b border-border pb-6');
    // The old bottom placement used border-t pt-6 — should be gone
    expect(source).not.toContain('border-t border-border pt-6');
  });

  it('places MergeControls before the error banner', () => {
    const controlsIdx = source.indexOf('<MergeControls');
    const errorBannerIdx = source.indexOf('Error banner');
    expect(controlsIdx).toBeGreaterThan(-1);
    expect(errorBannerIdx).toBeGreaterThan(-1);
    expect(controlsIdx).toBeLessThan(errorBannerIdx);
  });

  it('places MergeControls after the header section', () => {
    const headerComment = source.indexOf('{/* Header */}');
    const controlsIdx = source.indexOf('<MergeControls');
    const statsRow = source.indexOf('{/* Stats Row */}');
    expect(headerComment).toBeGreaterThan(-1);
    expect(controlsIdx).toBeGreaterThan(headerComment);
    expect(controlsIdx).toBeLessThan(statsRow);
  });

  it('passes required props to MergeControls', () => {
    const controlsBlock = source.substring(
      source.indexOf('<MergeControls'),
      source.indexOf('/>', source.indexOf('<MergeControls')) + 2
    );
    expect(controlsBlock).toContain('taskId={task.id}');
    expect(controlsBlock).toContain('onMerge={handleMerge}');
    expect(controlsBlock).toContain('onRequestChanges={handleRequestChanges}');
    expect(controlsBlock).toContain('onReject={handleReject}');
    expect(controlsBlock).toContain('loading={actionLoading}');
  });

  it('has exactly one MergeControls instance (not duplicated)', () => {
    const matches = source.match(/<MergeControls/g);
    expect(matches).toHaveLength(1);
  });
});
