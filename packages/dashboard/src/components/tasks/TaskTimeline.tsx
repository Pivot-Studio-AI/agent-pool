import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import type { AppEvent } from '../../lib/types';

const TIMELINE_EVENT_CONFIG: Record<string, { label: string; dotColor: string }> = {
  task_created: { label: 'Task created', dotColor: 'bg-accent' },
  task_assigned: { label: 'Assigned to agent', dotColor: 'bg-accent' },
  plan_submitted: { label: 'Plan submitted for review', dotColor: 'bg-amber' },
  plan_approved: { label: 'Plan approved', dotColor: 'bg-green' },
  plan_rejected: { label: 'Plan rejected', dotColor: 'bg-red' },
  execution_started: { label: 'Execution started', dotColor: 'bg-green' },
  execution_progress: { label: 'Agent progress', dotColor: 'bg-green' },
  execution_completed: { label: 'Execution completed', dotColor: 'bg-green' },
  agent_question: { label: 'Agent asked a question', dotColor: 'bg-amber' },
  diff_ready: { label: 'Diff ready for review', dotColor: 'bg-amber' },
  review_approved: { label: 'Review approved — merge requested', dotColor: 'bg-purple' },
  review_rejected: { label: 'Review rejected', dotColor: 'bg-red' },
  review_changes_requested: { label: 'Changes requested', dotColor: 'bg-amber' },
  merge_started: { label: 'Merge started', dotColor: 'bg-purple' },
  merge_completed: { label: 'Merge completed', dotColor: 'bg-purple' },
  merge_failed: { label: 'Merge failed', dotColor: 'bg-red' },
  task_completed: { label: 'Task completed', dotColor: 'bg-green' },
  task_errored: { label: 'Task errored', dotColor: 'bg-red' },
  task_rejected: { label: 'Task rejected', dotColor: 'bg-red' },
  task_cancelled: { label: 'Task cancelled', dotColor: 'bg-text-muted' },
  slot_claimed: { label: 'Slot claimed', dotColor: 'bg-accent' },
  slot_released: { label: 'Slot released', dotColor: 'bg-text-muted' },
  conflict_detected: { label: 'File conflict detected', dotColor: 'bg-amber' },
};

// Skip noisy progress events in the timeline
const SKIPPED_TYPES = new Set(['execution_progress', 'slot_claimed', 'slot_released']);

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventDetail(event: AppEvent): string | null {
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

interface TaskTimelineProps {
  taskId: string;
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AppEvent[]>(`/events?task_id=${taskId}&limit=100`);
      // Sort oldest first for timeline display
      const sorted = [...data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setEvents(sorted);
    } catch {
      // Non-critical — timeline is supplementary
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((e) => !SKIPPED_TYPES.has(e.event_type));

  if (loading) {
    return (
      <div className="text-text-muted text-xs animate-pulse-subtle py-2">Loading timeline...</div>
    );
  }

  if (filteredEvents.length === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg bg-surface p-4">
      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">
        Timeline
      </h3>
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-0">
          {filteredEvents.map((event) => {
            const config = TIMELINE_EVENT_CONFIG[event.event_type] || {
              label: event.event_type.replace(/_/g, ' '),
              dotColor: 'bg-text-muted',
            };
            const detail = getEventDetail(event);
            const isError = event.event_type === 'task_errored' || event.event_type === 'merge_failed';
            const isRejection = event.event_type === 'plan_rejected' || event.event_type === 'review_rejected';

            return (
              <div key={event.id} className="flex items-start gap-3 py-1.5 relative">
                <span className="relative flex h-[11px] w-[11px] shrink-0 mt-0.5 z-10">
                  <span className={`inline-flex rounded-full h-[11px] w-[11px] ${config.dotColor} ring-2 ring-surface`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-secondary text-sm">{config.label}</span>
                    <span className="text-text-muted text-[11px] font-mono shrink-0">
                      {formatTimestamp(event.created_at)}
                    </span>
                  </div>
                  {detail && (
                    <div
                      className={`text-xs mt-1 rounded px-2.5 py-1.5 ${
                        isError
                          ? 'text-red bg-red/5 border border-red/15'
                          : isRejection
                            ? 'text-red/80 bg-red/5 border border-red/15'
                            : 'text-text-muted bg-surface-hover/50'
                      }`}
                    >
                      {detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
