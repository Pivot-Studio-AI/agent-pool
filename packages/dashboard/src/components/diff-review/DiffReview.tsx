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
      <div className="p-6 text-text-muted text-sm animate-pulse-subtle">Loading diff...</div>
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
    <div className="p-6 space-y-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-3">{task.title}</h1>
        <div className="flex items-center gap-3 text-sm text-text-secondary flex-wrap">
          <Badge color={PRIORITY_COLORS[task.priority]?.replace('text-', '') || 'text-secondary'}>
            {task.priority}
          </Badge>
          <Badge color={STATUS_COLORS[task.status]?.replace('text-', '') || 'text-secondary'}>
            {task.status.replace(/_/g, ' ')}
          </Badge>
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
      <div className="border-b border-border/50 pb-6">
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
        <div className="bg-red/5 border border-red/20 rounded-lg px-4 py-2.5 text-sm text-red ring-1 ring-red/10">
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-5 text-sm">
        <span className="text-text-secondary">
          <span className="font-mono font-bold text-text-primary">{filesChanged.length}</span> file{filesChanged.length !== 1 ? 's' : ''} changed
        </span>
        <span className="text-green font-mono font-bold">+{totalAdditions}</span>
        <span className="text-red font-mono font-bold">-{totalDeletions}</span>
        {compliance && !compliance.compliant && (
          <Badge color="amber">Plan drift</Badge>
        )}
        {compliance && compliance.compliant && (
          <Badge color="green">Matches plan</Badge>
        )}
      </div>

      {/* Agent Summary */}
      {diff.summary && (
        <Card>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Agent Summary</div>
          <div className="text-sm text-text-primary whitespace-pre-wrap">{diff.summary}</div>
        </Card>
      )}

      {/* Compliance Warning */}
      {compliance && !compliance.compliant && (
        <div className="bg-amber/5 border border-amber/20 rounded-lg px-4 py-3 text-sm ring-1 ring-amber/10">
          <div className="font-semibold text-amber text-xs mb-1.5">Plan Compliance Drift</div>
          {compliance.unexpected.length > 0 && (
            <div className="text-text-secondary text-xs">
              Unexpected files: <span className="font-mono text-text-muted">{compliance.unexpected.join(', ')}</span>
            </div>
          )}
          {compliance.missing.length > 0 && (
            <div className="text-text-secondary text-xs">
              Missing from plan: <span className="font-mono text-text-muted">{compliance.missing.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Code Audit Report */}
      {diff.audit && (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Code Audit</div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ${
              diff.audit?.verdict === 'pass' ? 'bg-green/10 text-green ring-green/20' :
              diff.audit?.verdict === 'fail' ? 'bg-red/10 text-red ring-red/20' :
              'bg-amber/10 text-amber ring-amber/20'
            }`}>
              {(diff.audit.verdict ?? 'unknown').toUpperCase()}
            </span>
          </div>
          {diff.audit.bugs?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-red mb-1">Bugs ({diff.audit.bugs.length})</div>
              {diff.audit.bugs.map((b, i) => (
                <div key={i} className="text-xs text-text-secondary pl-3">- {b}</div>
              ))}
            </div>
          )}
          {diff.audit.security?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-red mb-1">Security ({diff.audit.security.length})</div>
              {diff.audit.security.map((s, i) => (
                <div key={i} className="text-xs text-text-secondary pl-3">- {s}</div>
              ))}
            </div>
          )}
          {diff.audit.testing?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-amber mb-1">Testing</div>
              {diff.audit.testing.map((t, i) => (
                <div key={i} className="text-xs text-text-secondary pl-3">- {t}</div>
              ))}
            </div>
          )}
          {diff.audit.quality?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-text-secondary mb-1">Quality</div>
              {diff.audit.quality.map((q, i) => (
                <div key={i} className="text-xs text-text-muted pl-3">- {q}</div>
              ))}
            </div>
          )}
          {!diff.audit.bugs?.length && !diff.audit.security?.length && !diff.audit.testing?.length && !diff.audit.quality?.length && (
            <div className="text-xs text-green">No issues found.</div>
          )}
        </Card>
      )}

      {/* Test Results */}
      {diff.test_results && (
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Tests</div>
            {diff.test_results.status === 'running' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-accent/10 text-accent ring-1 ring-accent/20">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-subtle" />
                Running...
              </span>
            )}
            {diff.test_results.status === 'passed' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-green/10 text-green ring-1 ring-green/20">
                {diff.test_results.tests_passed ?? 0}/{diff.test_results.tests_written ?? 0} PASSED
              </span>
            )}
            {diff.test_results.status === 'failed' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red/10 text-red ring-1 ring-red/20">
                {diff.test_results.tests_failed ?? 0} FAILED
              </span>
            )}
            {diff.test_results.status === 'skipped' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-text-muted/10 text-text-muted ring-1 ring-text-muted/10">
                SKIPPED
              </span>
            )}
          </div>
          {diff.test_results.failures?.length > 0 && (
            <div className="mt-2">
              {diff.test_results.failures.map((f, i) => (
                <div key={i} className="text-xs text-red pl-3 mb-1 font-mono">- {f}</div>
              ))}
            </div>
          )}
          {(diff.test_results.duration_ms ?? 0) > 0 && diff.test_results.status !== 'running' && (
            <div className="text-[10px] text-text-muted mt-1 font-mono">
              Completed in {((diff.test_results.duration_ms ?? 0) / 1000).toFixed(1)}s
            </div>
          )}
        </Card>
      )}

      {/* File Tree + Diff */}
      <div className="grid grid-cols-[240px_1fr] gap-4">
        {/* File tree sidebar */}
        <Card>
          <FileTree files={filesChanged} onFileClick={handleFileClick} />
        </Card>

        {/* Diff content */}
        <div className="space-y-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 w-fit shadow-card ring-1 ring-white/[0.03]">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                viewMode === 'side-by-side'
                  ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('line-by-line')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                viewMode === 'line-by-line'
                  ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Unified
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
