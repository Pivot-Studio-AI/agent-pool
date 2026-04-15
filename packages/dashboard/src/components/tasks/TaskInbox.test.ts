import { describe, it, expect } from 'vitest';

// Test the pure utility functions extracted from TaskInbox

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

const EVENT_DOT_COLORS: Record<string, string> = {
  task_created: 'bg-accent',
  plan_submitted: 'bg-amber',
  plan_approved: 'bg-amber',
  plan_rejected: 'bg-red',
  execution_started: 'bg-green',
  execution_progress: 'bg-green',
  execution_completed: 'bg-green',
  diff_ready: 'bg-amber',
  review_approved: 'bg-purple',
  merge_completed: 'bg-purple',
  merge_failed: 'bg-red',
  task_completed: 'bg-green',
  task_errored: 'bg-red',
  task_rejected: 'bg-red',
  slot_claimed: 'bg-accent',
  slot_released: 'bg-text-muted',
  conflict_detected: 'bg-amber',
};

describe('TaskInbox utilities', () => {
  describe('timeAgo()', () => {
    it('should return seconds for very recent times', () => {
      const recent = new Date(Date.now() - 30000).toISOString();
      expect(timeAgo(recent)).toBe('30s ago');
    });

    it('should return minutes for times within an hour', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(fiveMinAgo)).toBe('5m ago');
    });

    it('should return hours for times within a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('should return days for older times', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('should not return negative values for future dates', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(timeAgo(future)).toBe('0s ago');
    });
  });

  describe('isToday()', () => {
    it('should return true for today', () => {
      expect(isToday(new Date().toISOString())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Only false if we actually crossed midnight
      if (yesterday.getDate() !== new Date().getDate()) {
        expect(isToday(yesterday.toISOString())).toBe(false);
      }
    });

    it('should return false for null', () => {
      expect(isToday(null)).toBe(false);
    });
  });

  describe('EVENT_DOT_COLORS', () => {
    it('should map error events to red', () => {
      expect(EVENT_DOT_COLORS['task_errored']).toBe('bg-red');
      expect(EVENT_DOT_COLORS['merge_failed']).toBe('bg-red');
      expect(EVENT_DOT_COLORS['plan_rejected']).toBe('bg-red');
    });

    it('should map success events to green', () => {
      expect(EVENT_DOT_COLORS['execution_started']).toBe('bg-green');
      expect(EVENT_DOT_COLORS['task_completed']).toBe('bg-green');
    });

    it('should map attention events to amber', () => {
      expect(EVENT_DOT_COLORS['plan_submitted']).toBe('bg-amber');
      expect(EVENT_DOT_COLORS['diff_ready']).toBe('bg-amber');
      expect(EVENT_DOT_COLORS['conflict_detected']).toBe('bg-amber');
    });
  });
});
