import { useState } from 'react';
import { GitMerge, MessageSquare, X } from 'lucide-react';
import { Button } from '../shared/Button';

interface MergeControlsProps {
  taskId: string;
  onMerge: () => void;
  onRequestChanges: (comments: string) => void;
  onReject: () => void;
  loading?: boolean;
  testStatus?: 'running' | 'passed' | 'failed' | 'skipped' | null;
}

export function MergeControls({
  taskId,
  onMerge,
  onRequestChanges,
  onReject,
  loading = false,
  testStatus = null,
}: MergeControlsProps) {
  const testsRunning = testStatus === 'running';
  const testsFailed = testStatus === 'failed';
  const mergeDisabled = loading;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState('');

  const handleRequestChanges = () => {
    if (!showComments) {
      setShowComments(true);
      return;
    }
    const trimmed = comments.trim();
    if (!trimmed) return;
    onRequestChanges(trimmed);
    setComments('');
    setShowComments(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="merge"
          onClick={onMerge}
          loading={loading}
          disabled={mergeDisabled}
        >
          <GitMerge size={15} className="mr-0.5" />
          {testsRunning ? 'Tests Running...' : testsFailed ? 'Merge Anyway' : 'Approve & Merge'}
        </Button>
        <Button
          variant="default"
          onClick={handleRequestChanges}
          disabled={loading}
        >
          <MessageSquare size={15} className="mr-0.5" />
          {showComments ? 'Submit Changes' : 'Request Changes'}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={loading}
        >
          <X size={15} className="mr-0.5" />
          Reject
        </Button>
        {showComments && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setShowComments(false);
              setComments('');
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {showComments && (
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Describe the changes you'd like the agent to make..."
          rows={4}
          autoFocus
          className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 resize-none"
        />
      )}
    </div>
  );
}
