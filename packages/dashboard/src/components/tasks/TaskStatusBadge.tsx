import { Badge } from '../shared/Badge';
import type { TaskStatus } from '../../lib/types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  queued: { color: 'text-muted', label: 'Queued' },
  planning: { color: 'accent', label: 'Planning' },
  awaiting_approval: { color: 'amber', label: 'Needs Approval' },
  executing: { color: 'green', label: 'Executing' },
  awaiting_review: { color: 'amber', label: 'Needs Review' },
  merging: { color: 'purple', label: 'Merging' },
  completed: { color: 'green', label: 'Completed' },
  errored: { color: 'red', label: 'Errored' },
  rejected: { color: 'red', label: 'Rejected' },
};

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = statusConfig[status] ?? { color: 'text-muted', label: status };
  return (
    <Badge color={config.color} className={className}>
      {config.label}
    </Badge>
  );
}
