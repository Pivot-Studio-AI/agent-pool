import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Smoke tests for PlanReview layout changes.
 * The action buttons (ApprovalControls) were moved from the bottom of the page
 * to the top, immediately after the header. These tests verify that structural
 * invariant by reading the source file.
 */

const source = readFileSync(
  resolve(__dirname, 'PlanReview.tsx'),
  'utf-8'
);

describe('PlanReview layout structure', () => {
  it('renders ApprovalControls with border-b (top placement)', () => {
    expect(source).toContain('border-b border-border/50 pb-6');
    // The old bottom placement used border-t pt-6 — should be gone
    expect(source).not.toContain('border-t border-border pt-6');
  });

  it('places ApprovalControls before the error banner', () => {
    const controlsIdx = source.indexOf('<ApprovalControls');
    const errorBannerIdx = source.indexOf('Error banner');
    expect(controlsIdx).toBeGreaterThan(-1);
    expect(errorBannerIdx).toBeGreaterThan(-1);
    expect(controlsIdx).toBeLessThan(errorBannerIdx);
  });

  it('places ApprovalControls after the header section', () => {
    const headerComment = source.indexOf('{/* Header */}');
    const controlsIdx = source.indexOf('<ApprovalControls');
    const planContent = source.indexOf('{/* Plan Content */}');
    expect(headerComment).toBeGreaterThan(-1);
    expect(controlsIdx).toBeGreaterThan(headerComment);
    expect(controlsIdx).toBeLessThan(planContent);
  });

  it('passes required props to ApprovalControls', () => {
    const controlsBlock = source.substring(
      source.indexOf('<ApprovalControls'),
      source.indexOf('/>', source.indexOf('<ApprovalControls')) + 2
    );
    expect(controlsBlock).toContain('taskId={task.id}');
    expect(controlsBlock).toContain('planId={plan.id}');
    expect(controlsBlock).toContain('onApprove={handleApprove}');
    expect(controlsBlock).toContain('onReject={handleReject}');
    expect(controlsBlock).toContain('loading={actionLoading}');
  });
});
