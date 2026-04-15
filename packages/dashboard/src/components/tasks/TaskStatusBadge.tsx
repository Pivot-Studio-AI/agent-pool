import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { Badge } from '../shared/Badge';
import { useTaskStore } from '../../stores/task-store';
import { isTestsRunning } from '../../stores/task-store';
import type { TaskStatus } from '../../lib/types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  taskId?: string;
  deployStatus?: string | null;
  className?: string;
}

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  queued: { color: 'text-muted', label: 'Queued' },
  planning: { color: 'accent', label: 'Planning' },
  awaiting_approval: { color: 'amber', label: 'Needs Approval' },
  executing: { color: 'green', label: 'Executing' },
  awaiting_review: { color: 'amber', label: 'Needs Review' },
  merging: { color: 'purple', label: 'Merging' },
  deploying: { color: 'purple', label: 'Deploying' },
  completed: { color: 'green', label: 'Completed' },
  errored: { color: 'red', label: 'Errored' },
  rejected: { color: 'red', label: 'Rejected' },
  cancelled: { color: 'text-muted', label: 'Cancelled' },
};

function DeployIcon({ deployStatus }: { deployStatus: string }) {
  if (deployStatus === 'success') return <CheckCircle size={10} className="text-green" />;
  if (deployStatus === 'failed') return <XCircle size={10} className="text-red" />;
  if (deployStatus === 'pending') return <Loader size={10} className="text-amber animate-spin" />;
  return null;
}

export function TaskStatusBadge({ status, taskId, deployStatus, className }: TaskStatusBadgeProps) {
  const store = useTaskStore();
  const testsRunning = taskId ? isTestsRunning(store, taskId) : false;

  let config = statusConfig[status] ?? { color: 'text-muted', label: status };
  if (status === 'awaiting_review' && testsRunning) {
    config = { color: 'accent', label: 'Tests Running' };
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge color={config.color} className={className}>
        {config.label}
      </Badge>
      {deployStatus && <DeployIcon deployStatus={deployStatus} />}
    </span>
  );
}
