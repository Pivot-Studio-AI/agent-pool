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

export function EventItem({ event }: EventItemProps) {
  const dotColor = EVENT_DOT_COLORS[event.event_type] || 'bg-text-muted';
  const description = EVENT_DESCRIPTIONS[event.event_type] || event.event_type;
  const detail = event.payload?.message || event.payload?.title || '';

  return (
    <div className="flex items-start gap-3 py-2 px-2 rounded hover:bg-surface/50 transition-colors">
      <span className="text-text-muted text-xs w-16 shrink-0 pt-0.5 tabular-nums">
        {timeAgo(event.created_at)}
      </span>
      <span
        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dotColor}`}
      />
      <div className="min-w-0">
        <span className="text-text-secondary text-sm">{description}</span>
        {detail && (
          <span className="text-text-muted text-sm ml-2">— {detail}</span>
        )}
      </div>
    </div>
  );
}
