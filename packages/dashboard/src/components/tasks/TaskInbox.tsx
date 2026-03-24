import { Clock, AlertTriangle, Play, CheckCircle } from 'lucide-react';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { useTaskStore, getAttentionTasks, getActiveTasks } from '../../stores/task-store';
import { useEventStore } from '../../stores/event-store';
import { useSlotStore } from '../../stores/slot-store';
import { STATUS_COLORS } from '../../lib/constants';
import type { AppEvent } from '../../lib/types';

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

function eventDescription(event: AppEvent): string {
  const descriptions: Record<string, string> = {
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
    review_changes_requested: 'Changes requested',
    merge_started: 'Merge started',
    merge_completed: 'Code merged successfully',
    merge_failed: 'Merge failed',
    task_completed: 'Task completed successfully',
    task_errored: 'Task encountered an error',
    task_rejected: 'Task rejected',
    slot_claimed: 'Slot claimed',
    slot_released: 'Slot released',
    conflict_detected: 'File conflict detected',
  };
  return descriptions[event.event_type] || event.event_type;
}

export function TaskInbox() {
  const store = useTaskStore();
  const selectTask = useTaskStore((s) => s.selectTask);
  const events = useEventStore((s) => s.events);
  const slots = useSlotStore((s) => s.slots);

  const attentionTasks = getAttentionTasks(store);
  const activeTasks = getActiveTasks(store);
  const allTasks = Object.values(store.tasks);

  const completedToday = allTasks.filter(
    (t) => t.status === 'completed' && isToday(t.completed_at)
  ).length;

  const totalSlots = slots.length;
  const activeSlots = slots.filter(
    (s) => s.status === 'active' || s.status === 'claimed'
  ).length;

  const recentEvents = events.slice(0, 5);

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <AlertTriangle size={14} />
              <span>Needs Attention</span>
            </div>
            <div className="text-2xl font-bold text-amber">{attentionTasks.length}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Play size={14} />
              <span>Building</span>
            </div>
            <div className="text-2xl font-bold text-green">{activeTasks.length}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <Clock size={14} />
              <span>Slots Active</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {activeSlots}/{totalSlots}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-1">
              <CheckCircle size={14} />
              <span>Completed Today</span>
            </div>
            <div className="text-2xl font-bold text-green">{completedToday}</div>
          </div>
        </Card>
      </div>

      {/* Needs Your Attention */}
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-4">Needs Your Attention</h2>
        {attentionTasks.length === 0 ? (
          <div className="text-text-muted text-sm py-4">
            No tasks need your attention right now.
          </div>
        ) : (
          <div className="space-y-3">
            {attentionTasks.map((task) => (
              <Card key={task.id} className="cursor-pointer hover:border-accent/50 transition-colors">
                <button
                  className="w-full p-4 text-left"
                  onClick={() => selectTask(task.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-text-primary font-medium">{task.title}</span>
                      <Badge color={STATUS_COLORS[task.status]?.replace('text-', '') || 'text-secondary'}>
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <span className="text-text-muted text-xs">{timeAgo(task.created_at)}</span>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-4">Recent Activity</h2>
        {recentEvents.length === 0 ? (
          <div className="text-text-muted text-sm py-4">No recent activity.</div>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-2">
                <span className="text-text-muted text-xs w-16 shrink-0">
                  {timeAgo(event.created_at)}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    EVENT_DOT_COLORS[event.event_type] || 'bg-text-muted'
                  }`}
                />
                <span className="text-text-secondary text-sm">
                  {eventDescription(event)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
