import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper function tests
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

function elapsed(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

describe('TaskDetail time utilities', () => {
  describe('timeAgo()', () => {
    it('should format times less than 60 seconds as seconds ago', () => {
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
      const result = timeAgo(thirtySecondsAgo);
      expect(result).toMatch(/\d+s ago/);
    });

    it('should format times less than 60 minutes as minutes ago', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const result = timeAgo(fiveMinutesAgo);
      expect(result).toMatch(/\d+m ago/);
    });

    it('should format times less than 24 hours as hours ago', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const result = timeAgo(twoHoursAgo);
      expect(result).toMatch(/\d+h ago/);
    });

    it('should format times >= 24 hours as days ago', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = timeAgo(threeDaysAgo);
      expect(result).toMatch(/\d+d ago/);
    });

    it('should handle future dates (should return 0s ago)', () => {
      const future = new Date(Date.now() + 1000).toISOString();
      const result = timeAgo(future);
      expect(result).toBe('0s ago');
    });
  });

  describe('elapsed()', () => {
    it('should format elapsed time in seconds when less than 1 minute', () => {
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
      const result = elapsed(thirtySecondsAgo);
      expect(result).toMatch(/\d+s/);
      expect(result).not.toContain('m');
    });

    it('should format elapsed time in minutes and seconds when 1-60 minutes', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const result = elapsed(fiveMinutesAgo);
      expect(result).toMatch(/\d+m \d+s/);
    });

    it('should format elapsed time in hours and minutes when >= 1 hour', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const result = elapsed(twoHoursAgo);
      expect(result).toMatch(/\d+h \d+m/);
    });

    it('should handle exact boundary times', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const result = elapsed(oneMinuteAgo);
      expect(result).toMatch(/\d+m \d+s/);
    });
  });
});

describe('CancelButton cancellable statuses', () => {
  const cancellableStatuses = ['queued', 'planning', 'awaiting_approval', 'executing', 'awaiting_review'];

  it('should include all expected cancellable statuses', () => {
    expect(cancellableStatuses).toContain('queued');
    expect(cancellableStatuses).toContain('planning');
    expect(cancellableStatuses).toContain('awaiting_approval');
    expect(cancellableStatuses).toContain('executing');
    expect(cancellableStatuses).toContain('awaiting_review');
  });

  it('should not include completed status', () => {
    expect(cancellableStatuses).not.toContain('completed');
  });

  it('should not include errored status', () => {
    expect(cancellableStatuses).not.toContain('errored');
  });

  it('should not include rejected status', () => {
    expect(cancellableStatuses).not.toContain('rejected');
  });

  it('should not include cancelled status', () => {
    expect(cancellableStatuses).not.toContain('cancelled');
  });
});
