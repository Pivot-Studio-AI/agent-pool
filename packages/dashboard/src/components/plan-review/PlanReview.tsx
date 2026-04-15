import { useState, useEffect, useCallback } from 'react';
import { Clock, GitBranch } from 'lucide-react';
import { Badge } from '../shared/Badge';
import { Card } from '../shared/Card';
import { PlanSummary } from './PlanSummary';
import { FileManifest } from './FileManifest';
import { ApprovalControls } from './ApprovalControls';
import { api } from '../../api/client';
import { useTaskStore } from '../../stores/task-store';
import { PRIORITY_COLORS, STATUS_COLORS } from '../../lib/constants';
import type { Task, Plan } from '../../lib/types';

interface FileConflict {
  filePath: string;
  taskId: string;
  taskTitle: string;
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

interface PlanReviewProps {
  task: Task;
}

export function PlanReview({ task }: PlanReviewProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [conflicts, setConflicts] = useState<FileConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateTaskInStore = useTaskStore((s) => s.updateTaskInStore);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Plan[]>(`/tasks/${task.id}/plans`);
      setPlans(data);

      // Check file conflicts for the latest plan
      const latestPlan = data[data.length - 1];
      if (latestPlan && latestPlan.file_manifest?.length > 0) {
        try {
          const files = latestPlan.file_manifest.join(',');
          const conflictData = await api.get<FileConflict[]>(
            `/file-locks/check?files=${encodeURIComponent(files)}`
          );
          setConflicts(conflictData);
        } catch {
          // File conflict check is non-critical
          setConflicts([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const plan = plans[plans.length - 1]; // Latest plan

  const handleApprove = useCallback(async () => {
    if (!plan) return;
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task.id}/plans/${plan.id}/approve`);
      await api.patch(`/tasks/${task.id}`, { status: 'executing' });
      updateTaskInStore({ ...task, status: 'executing' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan');
    } finally {
      setActionLoading(false);
    }
  }, [task, plan, updateTaskInStore]);

  const handleReject = useCallback(
    async (feedback: string) => {
      if (!plan) return;
      setActionLoading(true);
      try {
        await api.post(`/tasks/${task.id}/plans/${plan.id}/reject`, { feedback });
        await api.patch(`/tasks/${task.id}`, { status: 'planning' });
        updateTaskInStore({ ...task, status: 'planning' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject plan');
      } finally {
        setActionLoading(false);
      }
    },
    [task, plan, updateTaskInStore]
  );

  if (loading) {
    return (
      <div className="p-6 text-text-muted text-sm">Loading plan...</div>
    );
  }

  if (error && !plan) {
    return (
      <div className="p-6 text-red text-sm">{error}</div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-text-muted text-sm">No plan submitted yet.</div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl overflow-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-text-primary mb-2">{task.title}</h1>
        <div className="flex items-center gap-3 text-sm text-text-secondary flex-wrap">
          <Badge color={PRIORITY_COLORS[task.priority]?.replace('text-', '') || 'text-secondary'}>
            {task.priority}
          </Badge>
          <Badge color={STATUS_COLORS[task.status]?.replace('text-', '') || 'text-secondary'}>
            {task.status.replace(/_/g, ' ')}
          </Badge>
          <span className="text-text-muted text-xs">Model: <span className="font-mono">{task.model_tier}</span></span>
          <span className="flex items-center gap-1 text-text-muted text-xs">
            <GitBranch size={12} />
            <span className="font-mono">{task.target_branch}</span>
          </span>
          <span className="flex items-center gap-1 text-text-muted text-xs font-mono">
            <Clock size={12} />
            {timeAgo(task.created_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-b border-border pb-5">
        <ApprovalControls
          taskId={task.id}
          planId={plan.id}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={actionLoading}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red/5 border border-red/20 rounded-lg px-4 py-2.5 text-sm text-red">
          {error}
        </div>
      )}

      {/* Plan Content */}
      <PlanSummary heading="Approach" content={plan.content} />

      {/* Reasoning */}
      {plan.reasoning && (
        <PlanSummary heading="Reasoning" content={plan.reasoning} />
      )}

      {/* File Manifest */}
      <FileManifest files={plan.file_manifest} conflicts={conflicts} />

      {/* Estimate */}
      {plan.estimate && (
        <Card>
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Estimate</h3>
          <div className="text-sm text-text-secondary">{plan.estimate}</div>
        </Card>
      )}

    </div>
  );
}
