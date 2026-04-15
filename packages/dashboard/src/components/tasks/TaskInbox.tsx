import { AlertTriangle, Play, Clock, CheckCircle, ArrowRight, XCircle, Loader, Rocket } from 'lucide-react';
import { Card } from '../shared/Card';
import { TaskStatusBadge } from './TaskStatusBadge';
import { useTaskStore, getAttentionTasks, getActiveTasks } from '../../stores/task-store';
import { useEventStore } from '../../stores/event-store';
import { useSlotStore } from '../../stores/slot-store';
import type { AppEvent, Task } from '../../lib/types';

function DeployBadge({ task }: { task: Task }) {
  if (!task.deploy_status) return null;
  if (task.deploy_status === 'success') {
    return <span aria-label="Deploy succeeded"><Rocket size={12} className="text-green" /></span>;
  }
  if (task.deploy_status === 'failed') {
    return <span aria-label="Deploy failed"><XCircle size={12} className="text-red" /></span>;
  }
  if (task.deploy_status === 'pending') {
    return <span aria-label="Deploying..."><Loader size={12} className="text-amber animate-spin" /></span>;
  }
  return null;
}

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

function StatCard({
  icon: Icon,
  label,
  value,
  valueColor,
  glowColor,
  iconBg,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  valueColor: string;
  glowColor?: string;
  iconBg?: string;
}) {
  return (
    <Card className={glowColor}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg || 'bg-surface-hover'} ring-1 ring-white/[0.04]`}>
          <Icon size={16} className="text-text-muted" />
        </div>
        <div>
          <div className="text-[10px] text-text-muted font-medium uppercase tracking-widest">{label}</div>
          <div className={`text-2xl font-bold ${valueColor} font-mono tracking-tight`}>{value}</div>
        </div>
      </div>
    </Card>
  );
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
    <div className="p-6 space-y-8 max-w-5xl animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={attentionTasks.length}
          valueColor="text-amber"
          glowColor={attentionTasks.length > 0 ? 'shadow-glow-amber' : undefined}
          iconBg={attentionTasks.length > 0 ? 'bg-amber/8' : undefined}
        />
        <StatCard
          icon={Play}
          label="Building"
          value={activeTasks.length}
          valueColor="text-green"
          iconBg={activeTasks.length > 0 ? 'bg-green/8' : undefined}
        />
        <StatCard icon={Clock} label="Slots Active" value={`${activeSlots}/${totalSlots}`} valueColor="text-text-primary" />
        <StatCard
          icon={CheckCircle}
          label="Completed Today"
          value={completedToday}
          valueColor="text-green"
          iconBg={completedToday > 0 ? 'bg-green/8' : undefined}
        />
      </div>

      {/* Needs Your Attention */}
      <section>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">
          Needs Your Attention
        </h2>
        {attentionTasks.length === 0 ? (
          <div className="text-text-muted text-sm py-8 text-center rounded-xl border border-dashed border-border">
            No tasks need your attention right now.
          </div>
        ) : (
          <div className="space-y-2">
            {attentionTasks.map((task) => (
              <button
                key={task.id}
                className="w-full text-left group"
                onClick={() => selectTask(task.id)}
              >
                <Card hover>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-text-primary font-medium text-sm group-hover:text-accent">{task.title}</span>
                      <TaskStatusBadge status={task.status} deployStatus={task.deploy_status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-xs font-mono">{timeAgo(task.created_at)}</span>
                      <ArrowRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">
          Recent Activity
        </h2>
        {recentEvents.length === 0 ? (
          <div className="text-text-muted text-sm py-8 text-center rounded-xl border border-dashed border-border">No recent activity.</div>
        ) : (
          <Card>
            <div className="divide-y divide-border/50">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-text-muted text-[11px] w-14 shrink-0 font-mono tabular-nums">
                    {timeAgo(event.created_at)}
                  </span>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        EVENT_DOT_COLORS[event.event_type] || 'bg-text-muted'
                      }`}
                    />
                  </span>
                  <span className="text-text-secondary text-sm">
                    {eventDescription(event)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
