import { useMemo, useCallback, useState } from 'react';
import { Loader, Clock, CheckCircle, XCircle, AlertTriangle, Ban, RotateCcw } from 'lucide-react';
import { useTaskStore } from '../../stores/task-store';
import { useEventStore } from '../../stores/event-store';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { PlanReview } from '../plan-review/PlanReview';
import { DiffReview } from '../diff-review/DiffReview';
import { PRIORITY_COLORS } from '../../lib/constants';
import { api } from '../../api/client';
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

function CancelButton({ task }: { task: Task }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateTaskInStore = useTaskStore((s) => s.updateTaskInStore);

  const handleCancel = useCallback(async () => {
    if (!confirm('Cancel this task? The agent will be stopped.')) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await api.post<Task>(`/tasks/${task.id}/cancel`);
      updateTaskInStore(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
    } finally {
      setCancelling(false);
    }
  }, [task, updateTaskInStore]);

  const cancellableStatuses = ['queued', 'planning', 'awaiting_approval', 'executing', 'awaiting_review', 'merging'];
  if (!cancellableStatuses.includes(task.status)) return null;

  return (
    <>
      <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling} disabled={cancelling}>
        <Ban size={13} className="mr-1" />
        Cancel
      </Button>
      {error && <span className="text-red text-xs">{error}</span>}
    </>
  );
}

function RetryButton({ task }: { task: Task }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateTaskInStore = useTaskStore((s) => s.updateTaskInStore);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    try {
      const updated = await api.post<Task>(`/tasks/${task.id}/retry`);
      updateTaskInStore(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task');
    } finally {
      setRetrying(false);
    }
  }, [task, updateTaskInStore]);

  const retryableStatuses = ['errored', 'cancelled', 'rejected'];
  if (!retryableStatuses.includes(task.status)) return null;

  return (
    <>
      <Button variant="default" size="sm" onClick={handleRetry} loading={retrying} disabled={retrying}>
        <RotateCcw size={13} className="mr-1" />
        Retry
      </Button>
      {error && <span className="text-red text-xs">{error}</span>}
    </>
  );
}

function TaskMetadata({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 text-sm text-text-secondary flex-wrap">
      <Badge color={PRIORITY_COLORS[task.priority]?.replace('text-', '') || 'text-secondary'}>
        {task.priority}
      </Badge>
      <span className="text-text-muted text-xs">Model: <span className="text-text-secondary font-mono">{task.model_tier}</span></span>
      <span className="text-text-muted text-xs">Branch: <span className="text-text-secondary font-mono">{task.target_branch}</span></span>
      <span className="text-text-muted text-xs font-mono">{timeAgo(task.created_at)}</span>
      <CancelButton task={task} />
      <RetryButton task={task} />
    </div>
  );
}

function StatusView({
  task,
  icon,
  iconColor,
  label,
  labelColor,
  subtitle,
  extra,
}: {
  task: Task;
  icon: React.ReactNode;
  iconColor?: string;
  label: string;
  labelColor: string;
  subtitle?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="p-6 space-y-5 max-w-3xl animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-text-primary mb-2">{task.title}</h1>
        <TaskMetadata task={task} />
      </div>
      <Card>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="p-3 rounded-2xl bg-surface-hover ring-1 ring-white/[0.04]">
            {icon}
          </div>
          <div className={`${labelColor} font-semibold text-sm`}>{label}</div>
          {subtitle && <div className="text-text-muted text-xs font-mono">{subtitle}</div>}
          {extra}
        </div>
      </Card>
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
    <StatusView
      task={task}
      icon={<Loader className="text-green animate-spin" size={24} />}
      label="Agent is building..."
      labelColor="text-green"
      subtitle={`Elapsed: ${elapsed(task.created_at)}`}
      extra={
        latestProgress ? (
          <div className="text-text-secondary text-xs text-center mt-1 px-6 max-w-md bg-surface-hover/50 rounded-lg py-2">
            {latestProgress.payload?.message || 'Working...'}
          </div>
        ) : null
      }
    />
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
    <StatusView
      task={task}
      icon={<Clock className="text-text-muted" size={24} />}
      label="Waiting in Queue"
      labelColor="text-text-secondary"
      subtitle={`Position #${queuePosition}`}
    />
  );
}

function PlanningView({ task }: { task: Task }) {
  return (
    <StatusView
      task={task}
      icon={<Loader className="text-accent animate-spin" size={24} />}
      label="Agent is analyzing..."
      labelColor="text-accent"
      subtitle="Generating a plan for this task"
    />
  );
}

function MergingView({ task }: { task: Task }) {
  return (
    <StatusView
      task={task}
      icon={<Loader className="text-purple animate-spin" size={24} />}
      label="Merging..."
      labelColor="text-purple"
      subtitle={`Merging changes into ${task.target_branch}`}
    />
  );
}

function DeployingView({ task }: { task: Task }) {
  return (
    <StatusView
      task={task}
      icon={<Loader className="text-purple animate-spin" size={24} />}
      label="Deploying to production..."
      labelColor="text-purple"
      subtitle="Monitoring GitHub Actions deploy"
    />
  );
}

function CompletedView({ task }: { task: Task }) {
  const events = useEventStore((s) => s.events);
  const errorReason = useMemo(() => {
    if (task.status !== 'errored') return null;
    const errorEvent = events.find(
      (e) => e.task_id === task.id && e.event_type === 'task_errored'
    );
    return errorEvent?.payload?.reason as string | undefined;
  }, [events, task.id, task.status]);

  const icon =
    task.status === 'completed' ? (
      <CheckCircle className="text-green" size={24} />
    ) : task.status === 'errored' ? (
      <XCircle className="text-red" size={24} />
    ) : task.status === 'cancelled' ? (
      <Ban className="text-text-muted" size={24} />
    ) : (
      <AlertTriangle className="text-red" size={24} />
    );

  const label =
    task.status === 'completed'
      ? 'Task Completed'
      : task.status === 'errored'
        ? 'Task Errored'
        : task.status === 'cancelled'
          ? 'Task Cancelled'
          : 'Task Rejected';

  const labelColor =
    task.status === 'completed' ? 'text-green'
    : task.status === 'cancelled' ? 'text-text-muted'
    : 'text-red';

  return (
    <StatusView
      task={task}
      icon={icon}
      label={label}
      labelColor={labelColor}
      subtitle={task.completed_at ? `Finished ${timeAgo(task.completed_at)}` : undefined}
      extra={
        errorReason ? (
          <div className="text-red text-xs mt-2 px-6 max-w-lg text-center break-words bg-red/5 rounded-lg p-3 ring-1 ring-red/10">
            {errorReason}
          </div>
        ) : null
      }
    />
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
    case 'merging':
      return <MergingView task={task} />;
    case 'deploying':
      return <DeployingView task={task} />;
    case 'queued':
      return <QueuedView task={task} />;
    case 'planning':
      return <PlanningView task={task} />;
    case 'completed':
    case 'errored':
    case 'rejected':
    case 'cancelled':
      return <CompletedView task={task} />;
    default:
      return (
        <div className="p-6 text-text-muted">
          Unknown task status: {task.status}
        </div>
      );
  }
}
