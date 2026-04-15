import type { AppEvent, EventType } from '../../lib/types';

const EVENT_DOT_COLORS: Record<string, string> = {
  task_created: 'bg-accent',
  task_assigned: 'bg-accent',
  plan_submitted: 'bg-amber',
  plan_approved: 'bg-amber',
  plan_rejected: 'bg-red',
  execution_started: 'bg-green',
  execution_progress: 'bg-green',
  execution_completed: 'bg-green',
  agent_question: 'bg-amber',
  diff_ready: 'bg-amber',
  review_approved: 'bg-purple',
  review_rejected: 'bg-red',
  review_changes_requested: 'bg-amber',
  merge_started: 'bg-purple',
  merge_completed: 'bg-purple',
  merge_failed: 'bg-red',
  task_completed: 'bg-green',
  task_errored: 'bg-red',
  task_rejected: 'bg-red',
  slot_claimed: 'bg-accent',
  slot_released: 'bg-text-muted',
  conflict_detected: 'bg-amber',
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  task_created: 'New task created',
  task_assigned: 'Task assigned to agent',
  plan_submitted: 'Plan submitted for review',
  plan_approved: 'Plan approved',
  plan_rejected: 'Plan rejected',
  execution_started: 'Agent started building',
  execution_progress: 'Agent progress update',
  execution_completed: 'Agent finished building',
  agent_question: 'Agent has a question',
  diff_ready: 'Diff ready for review',
  review_approved: 'Review approved',
  review_rejected: 'Review rejected',
  review_changes_requested: 'Changes requested on review',
  merge_started: 'Merge started',
  merge_completed: 'Code merged successfully',
  merge_failed: 'Merge failed',
  task_completed: 'Task completed successfully',
  task_errored: 'Task encountered an error',
  task_rejected: 'Task rejected',
  slot_claimed: 'Slot claimed by agent',
  slot_released: 'Slot released',
  conflict_detected: 'File conflict detected',
};

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

interface EventItemProps {
  event: AppEvent;
}

function getEventDetail(event: AppEvent): string | null {
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

export function EventItem({ event }: EventItemProps) {
  const dotColor = EVENT_DOT_COLORS[event.event_type] || 'bg-text-muted';
  const description = EVENT_DESCRIPTIONS[event.event_type] || event.event_type;
  const detail = getEventDetail(event);
  const isError = event.event_type === 'task_errored' || event.event_type === 'merge_failed';
  const isRejection = event.event_type === 'plan_rejected' || event.event_type === 'review_rejected' || event.event_type === 'task_rejected';

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover/40 group">
      <span className="text-text-muted text-[11px] w-16 shrink-0 pt-0.5 tabular-nums font-mono">
        {timeAgo(event.created_at)}
      </span>
      <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-text-secondary text-sm group-hover:text-text-primary">{description}</span>
        {detail && (
          <div
            className={`text-xs mt-1 rounded px-2 py-1 ${
              isError
                ? 'text-red bg-red/5 border border-red/15'
                : isRejection
                  ? 'text-red/80 bg-red/5 border border-red/15'
                  : 'text-text-muted'
            }`}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
