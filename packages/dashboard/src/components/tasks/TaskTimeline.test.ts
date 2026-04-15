import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Inline pure functions from TaskTimeline.tsx for unit testing
const SKIPPED_TYPES = new Set(['execution_progress', 'slot_claimed', 'slot_released']);

const TIMELINE_EVENT_CONFIG: Record<string, { label: string; dotColor: string }> = {
  task_created: { label: 'Task created', dotColor: 'bg-accent' },
  plan_submitted: { label: 'Plan submitted for review', dotColor: 'bg-amber' },
  plan_approved: { label: 'Plan approved', dotColor: 'bg-green' },
  plan_rejected: { label: 'Plan rejected', dotColor: 'bg-red' },
  execution_started: { label: 'Execution started', dotColor: 'bg-green' },
  execution_progress: { label: 'Agent progress', dotColor: 'bg-green' },
  task_completed: { label: 'Task completed', dotColor: 'bg-green' },
  task_errored: { label: 'Task errored', dotColor: 'bg-red' },
  merge_completed: { label: 'Merge completed', dotColor: 'bg-purple' },
  merge_failed: { label: 'Merge failed', dotColor: 'bg-red' },
  task_cancelled: { label: 'Task cancelled', dotColor: 'bg-text-muted' },
};

function getEventDetail(event: { event_type: string; payload?: Record<string, any> }): string | null {
  const p = event.payload;
  if (!p) return null;

  switch (event.event_type) {
    case 'plan_rejected':
      return p.feedback || p.reason || p.reviewer_feedback || null;
    case 'review_rejected':
      return p.feedback || p.reason || null;
    case 'review_changes_requested':
      return p.comments || p.feedback || null;
    case 'task_errored':
      return p.reason || p.error || p.message || null;
    case 'merge_failed':
      return p.reason || p.error || p.message || null;
    case 'agent_question':
      return p.question || p.message || null;
    case 'conflict_detected':
      return p.file_path || p.message || null;
    default:
      return p.message || null;
  }
}

const source = readFileSync(resolve(__dirname, 'TaskTimeline.tsx'), 'utf-8');

describe('TaskTimeline SKIPPED_TYPES', () => {
  it('skips execution_progress events', () => {
    expect(SKIPPED_TYPES.has('execution_progress')).toBe(true);
  });

  it('skips slot_claimed and slot_released events', () => {
    expect(SKIPPED_TYPES.has('slot_claimed')).toBe(true);
    expect(SKIPPED_TYPES.has('slot_released')).toBe(true);
  });

  it('does not skip meaningful events', () => {
    expect(SKIPPED_TYPES.has('task_created')).toBe(false);
    expect(SKIPPED_TYPES.has('plan_submitted')).toBe(false);
    expect(SKIPPED_TYPES.has('task_errored')).toBe(false);
  });
});

describe('TaskTimeline getEventDetail()', () => {
  it('returns null for events without payload', () => {
    expect(getEventDetail({ event_type: 'task_created' })).toBeNull();
  });

  it('extracts feedback for plan_rejected', () => {
    expect(getEventDetail({ event_type: 'plan_rejected', payload: { feedback: 'use a different approach' } })).toBe('use a different approach');
  });

  it('extracts comments for review_changes_requested', () => {
    expect(getEventDetail({ event_type: 'review_changes_requested', payload: { comments: 'fix the types' } })).toBe('fix the types');
  });

  it('returns message for default event types', () => {
    expect(getEventDetail({ event_type: 'task_created', payload: { message: 'new task' } })).toBe('new task');
    // Unlike EventItem, the default case does NOT fall back to title
    expect(getEventDetail({ event_type: 'task_created', payload: { title: 'some title' } })).toBeNull();
  });
});

describe('TaskTimeline TIMELINE_EVENT_CONFIG', () => {
  it('has config for task_cancelled (not present in EventItem EVENT_DOT_COLORS)', () => {
    expect(TIMELINE_EVENT_CONFIG['task_cancelled']).toEqual({
      label: 'Task cancelled',
      dotColor: 'bg-text-muted',
    });
  });

  it('uses green dot for successful execution events', () => {
    expect(TIMELINE_EVENT_CONFIG['execution_started']?.dotColor).toBe('bg-green');
    expect(TIMELINE_EVENT_CONFIG['task_completed']?.dotColor).toBe('bg-green');
  });

  it('uses red dot for error/rejection events', () => {
    expect(TIMELINE_EVENT_CONFIG['task_errored']?.dotColor).toBe('bg-red');
    expect(TIMELINE_EVENT_CONFIG['merge_failed']?.dotColor).toBe('bg-red');
    expect(TIMELINE_EVENT_CONFIG['plan_rejected']?.dotColor).toBe('bg-red');
  });
});

describe('TaskTimeline structure', () => {
  it('sorts events oldest-first for timeline display', () => {
    expect(source).toContain('new Date(a.created_at).getTime() - new Date(b.created_at).getTime()');
  });

  it('filters out skipped event types', () => {
    expect(source).toContain('!SKIPPED_TYPES.has(e.event_type)');
  });

  it('falls back gracefully for unknown event types', () => {
    expect(source).toContain("event.event_type.replace(/_/g, ' ')");
    expect(source).toContain("dotColor: 'bg-text-muted'");
  });
});
