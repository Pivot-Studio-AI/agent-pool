import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, GitBranch } from 'lucide-react';
import { Badge } from '../shared/Badge';
import { Card } from '../shared/Card';
import { FileTree } from './FileTree';
import { DiffViewer } from './DiffViewer';
import { MergeControls } from './MergeControls';
import { api } from '../../api/client';
import { useTaskStore } from '../../stores/task-store';
import { PRIORITY_COLORS, STATUS_COLORS } from '../../lib/constants';
import type { Task, Diff } from '../../lib/types';

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

interface DiffReviewProps {
  task: Task;
}

export function DiffReview({ task }: DiffReviewProps) {
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'line-by-line'>('side-by-side');
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const updateTaskInStore = useTaskStore((s) => s.updateTaskInStore);

  const fetchDiffs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Diff[]>(`/tasks/${task.id}/diffs`);
      setDiffs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diffs');
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  const diff = diffs[diffs.length - 1]; // Latest diff

  const handleFileClick = useCallback((path: string) => {
    if (!diffContainerRef.current) return;
    // diff2html generates file headers with the file path
    const fileHeaders = diffContainerRef.current.querySelectorAll('.d2h-file-name');
    for (const header of fileHeaders) {
      if (header.textContent?.includes(path)) {
        const fileWrapper = header.closest('.d2h-file-wrapper');
        if (fileWrapper) {
          fileWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
    }
  }, []);

  const handleMerge = useCallback(async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task.id}/merge/approve`);
      updateTaskInStore({ ...task, status: 'merging' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve merge');
    } finally {
      setActionLoading(false);
    }
  }, [task, updateTaskInStore]);

  const handleRequestChanges = useCallback(
    async (comments: string) => {
      setActionLoading(true);
      try {
        await api.post(`/tasks/${task.id}/review/request-changes`, { comments });
        updateTaskInStore({ ...task, status: 'executing' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request changes');
      } finally {
        setActionLoading(false);
      }
    },
    [task, updateTaskInStore]
  );

  const handleReject = useCallback(async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task.id}/merge/reject`);
      updateTaskInStore({ ...task, status: 'rejected' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }, [task, updateTaskInStore]);

  if (loading) {
    return (
      <div className="p-6 text-text-muted text-sm">Loading diff...</div>
    );
  }

  if (error && !diff) {
    return (
      <div className="p-6 text-red text-sm">{error}</div>
    );
  }

  if (!diff) {
    return (
      <div className="p-6 text-text-muted text-sm">No diff available yet.</div>
    );
  }

  const totalAdditions = diff.additions;
  const totalDeletions = diff.deletions;
  const filesChanged = diff.files_changed;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-3">{task.title}</h1>
        <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap">
          <Badge color={PRIORITY_COLORS[task.priority]?.replace('text-', '') || 'text-secondary'}>
            {task.priority}
          </Badge>
          <Badge color={STATUS_COLORS[task.status]?.replace('text-', '') || 'text-secondary'}>
            {task.status.replace(/_/g, ' ')}
          </Badge>
          <span className="flex items-center gap-1">
            <GitBranch size={14} />
            {task.target_branch}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {timeAgo(task.created_at)}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red/10 border border-red/30 rounded px-4 py-2 text-sm text-red">
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-text-secondary">
          {filesChanged.length} file{filesChanged.length !== 1 ? 's' : ''} changed
        </span>
        <span className="text-green">+{totalAdditions}</span>
        <span className="text-red">-{totalDeletions}</span>
      </div>

      {/* File Tree + Diff */}
      <div className="grid grid-cols-[250px_1fr] gap-6">
        {/* File tree sidebar */}
        <Card>
          <FileTree files={filesChanged} onFileClick={handleFileClick} />
        </Card>

        {/* Diff content */}
        <div className="space-y-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('line-by-line')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'line-by-line'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Line by Line
            </button>
          </div>

          {/* Diff viewer */}
          <div ref={diffContainerRef}>
            <DiffViewer diffContent={diff.diff_content} viewMode={viewMode} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-6">
        <MergeControls
          taskId={task.id}
          onMerge={handleMerge}
          onRequestChanges={handleRequestChanges}
          onReject={handleReject}
          loading={actionLoading}
        />
      </div>
    </div>
  );
}
