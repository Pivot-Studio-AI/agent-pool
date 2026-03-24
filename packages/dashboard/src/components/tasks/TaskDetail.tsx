import { useMemo } from 'react';
import { Loader, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTaskStore } from '../../stores/task-store';
import { useEventStore } from '../../stores/event-store';
import { Badge } from '../shared/Badge';
import { Card } from '../shared/Card';
import { PlanReview } from '../plan-review/PlanReview';
import { DiffReview } from '../diff-review/DiffReview';
import { PRIORITY_COLORS } from '../../lib/constants';
import type { Task } from '../../lib/types';

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

function TaskMetadata({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap">
      <Badge color={PRIORITY_COLORS[task.priority]?.replace('text-', '') || 'text-secondary'}>
        {task.priority}
      </Badge>
      <span>Model: {task.model_tier}</span>
      <span>Branch: {task.target_branch}</span>
      <span>Created {timeAgo(task.created_at)}</span>
    </div>
  );
}

function ExecutingView({ task }: { task: Task }) {
  const events = useEventStore((s) => s.events);

  const latestProgress = useMemo(() => {
    return events.find(
      (e) =>
        e.task_id === task.id &&
        (e.event_type === 'execution_progress' || e.event_type === 'execution_started')
    );
  }, [events, task.id]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{task.title}</h1>
        <TaskMetadata task={task} />
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader className="text-green animate-spin" size={32} />
          <div className="text-green font-medium">Agent is building...</div>
          <div className="text-text-muted text-sm">
            Elapsed: {elapsed(task.created_at)}
          </div>
          {latestProgress && (
            <div className="text-text-secondary text-sm text-center mt-2 px-4">
              {latestProgress.payload?.message || 'Working...'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function QueuedView({ task }: { task: Task }) {
  const tasks = useTaskStore((s) => s.tasks);

  const queuePosition = useMemo(() => {
    const queued = Object.values(tasks)
      .filter((t) => t.status === 'queued')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const index = queued.findIndex((t) => t.id === task.id);
    return index >= 0 ? index + 1 : queued.length;
  }, [tasks, task.id]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{task.title}</h1>
        <TaskMetadata task={task} />
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 py-4">
          <Clock className="text-text-muted" size={32} />
          <div className="text-text-secondary font-medium">Waiting in Queue</div>
          <div className="text-text-muted text-sm">
            Position #{queuePosition} in queue
          </div>
        </div>
      </Card>
    </div>
  );
}

function PlanningView({ task }: { task: Task }) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{task.title}</h1>
        <TaskMetadata task={task} />
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader className="text-accent animate-spin" size={32} />
          <div className="text-accent font-medium">Agent is analyzing...</div>
          <div className="text-text-muted text-sm">
            Generating a plan for this task
          </div>
        </div>
      </Card>
    </div>
  );
}

function CompletedView({ task }: { task: Task }) {
  const icon =
    task.status === 'completed' ? (
      <CheckCircle className="text-green" size={32} />
    ) : task.status === 'errored' ? (
      <XCircle className="text-red" size={32} />
    ) : (
      <AlertTriangle className="text-red" size={32} />
    );

  const label =
    task.status === 'completed'
      ? 'Task Completed'
      : task.status === 'errored'
        ? 'Task Errored'
        : 'Task Rejected';

  const labelColor = task.status === 'completed' ? 'text-green' : 'text-red';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{task.title}</h1>
        <TaskMetadata task={task} />
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 py-4">
          {icon}
          <div className={`${labelColor} font-medium`}>{label}</div>
          {task.completed_at && (
            <div className="text-text-muted text-sm">
              Finished {timeAgo(task.completed_at)}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export function TaskDetail() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const tasks = useTaskStore((s) => s.tasks);

  if (!selectedTaskId) return null;

  const task = tasks[selectedTaskId];
  if (!task) {
    return (
      <div className="p-6 text-text-secondary text-sm">Task not found.</div>
    );
  }

  switch (task.status) {
    case 'awaiting_approval':
      return <PlanReview task={task} />;
    case 'awaiting_review':
      return <DiffReview task={task} />;
    case 'executing':
      return <ExecutingView task={task} />;
    case 'queued':
      return <QueuedView task={task} />;
    case 'planning':
      return <PlanningView task={task} />;
    case 'completed':
    case 'errored':
    case 'rejected':
      return <CompletedView task={task} />;
    default:
      return (
        <div className="p-6 text-text-muted">
          Unknown task status: {task.status}
        </div>
      );
  }
}
