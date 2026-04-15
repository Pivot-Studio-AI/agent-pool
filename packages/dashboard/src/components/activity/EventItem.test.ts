import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Inline the pure function from EventItem.tsx for unit testing
function getEventDetail(event: { event_type: string; payload?: Record<string, any> }): string | null {
  const p = event.payload;
  if (!p) return null;

  switch (event.event_type) {
    case 'task_errored':
      return p.reason || p.error || p.message || null;
    case 'merge_failed':
      return p.reason || p.error || p.message || null;
    case 'plan_rejected':
      return p.feedback || p.reason || p.reviewer_feedback || null;
    case 'review_rejected':
      return p.feedback || p.reason || null;
    case 'review_changes_requested':
      return p.comments || p.feedback || null;
    case 'agent_question':
      return p.question || p.message || null;
    case 'conflict_detected':
      return p.file_path || p.message || null;
    case 'task_rejected':
      return p.feedback || p.reason || null;
    default:
      return p.message || p.title || null;
  }
}

const source = readFileSync(resolve(__dirname, 'EventItem.tsx'), 'utf-8');

describe('EventItem getEventDetail()', () => {
  it('returns null when payload is missing', () => {
    expect(getEventDetail({ event_type: 'task_created', payload: undefined })).toBeNull();
  });

  it('extracts reason for task_errored events', () => {
    expect(getEventDetail({ event_type: 'task_errored', payload: { reason: 'OOM killed' } })).toBe('OOM killed');
  });

  it('falls back to error then message for task_errored', () => {
    expect(getEventDetail({ event_type: 'task_errored', payload: { error: 'crash' } })).toBe('crash');
    expect(getEventDetail({ event_type: 'task_errored', payload: { message: 'fail' } })).toBe('fail');
  });

  it('extracts feedback for plan_rejected with fallback chain', () => {
    expect(getEventDetail({ event_type: 'plan_rejected', payload: { feedback: 'bad plan' } })).toBe('bad plan');
    expect(getEventDetail({ event_type: 'plan_rejected', payload: { reviewer_feedback: 'nope' } })).toBe('nope');
  });

  it('extracts question for agent_question events', () => {
    expect(getEventDetail({ event_type: 'agent_question', payload: { question: 'which DB?' } })).toBe('which DB?');
  });

  it('extracts file_path for conflict_detected events', () => {
    expect(getEventDetail({ event_type: 'conflict_detected', payload: { file_path: 'src/index.ts' } })).toBe('src/index.ts');
  });

  it('falls back to message/title for unknown event types', () => {
    expect(getEventDetail({ event_type: 'slot_claimed', payload: { message: 'slot 1' } })).toBe('slot 1');
    expect(getEventDetail({ event_type: 'slot_claimed', payload: { title: 'claimed' } })).toBe('claimed');
  });
});

describe('EventItem structure', () => {
  it('uses getEventDetail instead of inline payload access', () => {
    // Old pattern was: event.payload?.message || event.payload?.title
    // New pattern uses getEventDetail function
    expect(source).toContain('function getEventDetail');
    expect(source).toContain('const detail = getEventDetail(event)');
  });

  it('renders detail in a styled div (not inline span)', () => {
    // The new pattern uses a <div> block for detail, not an inline <span>
    expect(source).not.toContain('— {detail}');
    expect(source).toContain('{detail}');
  });

  it('applies error styling for task_errored and merge_failed', () => {
    expect(source).toContain("const isError = event.event_type === 'task_errored' || event.event_type === 'merge_failed'");
  });

  it('applies rejection styling for rejected event types', () => {
    expect(source).toContain("const isRejection = event.event_type === 'plan_rejected'");
    expect(source).toContain("event.event_type === 'review_rejected'");
    expect(source).toContain("event.event_type === 'task_rejected'");
  });
});
