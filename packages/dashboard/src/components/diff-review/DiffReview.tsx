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
  }, [task.id, task.updated_at]);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  const diff = diffs[diffs.length - 1]; // Latest diff

  const handleFileClick = useCallback((path: string) => {
    if (!diffContainerRef.current) return;
    // diff2html generates file headers with the file path
    const fileHeaders = diffContainerRef.current.querySelectorAll('.d2h-file-name');
    for (const header of Array.from(fileHeaders)) {
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
  const filesChanged = diff.files_changed ?? [];

  // Parse compliance data with type safety
  const compliance = (() => {
    const c = diff.compliance;
    if (!c || typeof c !== 'object') return null;
    const compliant = 'compliant' in c ? Boolean(c.compliant) : null;
    const unexpected = Array.isArray((c as any).unexpected) ? (c as any).unexpected as string[] : [];
    const missing = Array.isArray((c as any).missing) ? (c as any).missing as string[] : [];
    return compliant !== null ? { compliant, unexpected, missing } : null;
  })();

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

      {/* Actions — at top for quick access */}
      <div className="border-b border-border pb-6">
        <MergeControls
          taskId={task.id}
          onMerge={handleMerge}
          onRequestChanges={handleRequestChanges}
          onReject={handleReject}
          loading={actionLoading}
          testStatus={diff.test_results?.status ?? null}
        />
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
        {compliance && !compliance.compliant && (
          <span className="text-amber flex items-center gap-1">
            Plan drift detected
          </span>
        )}
        {compliance && compliance.compliant && (
          <span className="text-green flex items-center gap-1">
            Matches plan
          </span>
        )}
      </div>

      {/* Agent Summary */}
      {diff.summary && (
        <Card>
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Agent Summary</div>
            <div className="text-sm text-text-primary whitespace-pre-wrap">{diff.summary}</div>
          </div>
        </Card>
      )}

      {/* Compliance Warning */}
      {compliance && !compliance.compliant && (
        <div className="bg-amber/10 border border-amber/30 rounded px-4 py-3 text-sm">
          <div className="font-medium text-amber mb-1">Plan Compliance Drift</div>
          {compliance.unexpected.length > 0 && (
            <div className="text-text-secondary">
              Unexpected files: {compliance.unexpected.join(', ')}
            </div>
          )}
          {compliance.missing.length > 0 && (
            <div className="text-text-secondary">
              Missing from plan: {compliance.missing.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Code Audit Report */}
      {diff.audit && (
        <Card>
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Code Audit</div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                diff.audit?.verdict === 'pass' ? 'bg-green/20 text-green' :
                diff.audit?.verdict === 'fail' ? 'bg-red/20 text-red' :
                'bg-amber/20 text-amber'
              }`}>
                {(diff.audit.verdict ?? 'unknown').toUpperCase()}
              </span>
            </div>
            {diff.audit.bugs?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-red mb-1">Bugs ({diff.audit.bugs.length})</div>
                {diff.audit.bugs.map((b, i) => (
                  <div key={i} className="text-sm text-text-secondary pl-3">- {b}</div>
                ))}
              </div>
            )}
            {diff.audit.security?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-red mb-1">Security ({diff.audit.security.length})</div>
                {diff.audit.security.map((s, i) => (
                  <div key={i} className="text-sm text-text-secondary pl-3">- {s}</div>
                ))}
              </div>
            )}
            {diff.audit.testing?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-amber mb-1">Testing</div>
                {diff.audit.testing.map((t, i) => (
                  <div key={i} className="text-sm text-text-secondary pl-3">- {t}</div>
                ))}
              </div>
            )}
            {diff.audit.quality?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-text-secondary mb-1">Quality</div>
                {diff.audit.quality.map((q, i) => (
                  <div key={i} className="text-sm text-text-muted pl-3">- {q}</div>
                ))}
              </div>
            )}
            {!diff.audit.bugs?.length && !diff.audit.security?.length && !diff.audit.testing?.length && !diff.audit.quality?.length && (
              <div className="text-sm text-green">No issues found.</div>
            )}
          </div>
        </Card>
      )}

      {/* Test Results */}
      {diff.test_results && (
        <Card>
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tests</div>
              {diff.test_results.status === 'running' && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-accent/20 text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Running...
                </span>
              )}
              {diff.test_results.status === 'passed' && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green/20 text-green">
                  {diff.test_results.tests_passed ?? 0}/{diff.test_results.tests_written ?? 0} PASSED
                </span>
              )}
              {diff.test_results.status === 'failed' && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red/20 text-red">
                  {diff.test_results.tests_failed ?? 0} FAILED
                </span>
              )}
              {diff.test_results.status === 'skipped' && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-text-muted/20 text-text-muted">
                  SKIPPED
                </span>
              )}
            </div>
            {diff.test_results.failures?.length > 0 && (
              <div className="mt-2">
                {diff.test_results.failures.map((f, i) => (
                  <div key={i} className="text-sm text-red pl-3 mb-1">- {f}</div>
                ))}
              </div>
            )}
            {(diff.test_results.duration_ms ?? 0) > 0 && diff.test_results.status !== 'running' && (
              <div className="text-xs text-text-muted mt-1">
                Completed in {((diff.test_results.duration_ms ?? 0) / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        </Card>
      )}

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

    </div>
  );
}
