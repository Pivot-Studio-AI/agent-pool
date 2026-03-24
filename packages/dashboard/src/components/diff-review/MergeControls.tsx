import { useState } from 'react';
import { Button } from '../shared/Button';

interface MergeControlsProps {
  taskId: string;
  onMerge: () => void;
  onRequestChanges: (comments: string) => void;
  onReject: () => void;
  loading?: boolean;
}

export function MergeControls({
  taskId,
  onMerge,
  onRequestChanges,
  onReject,
  loading = false,
}: MergeControlsProps) {
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
          disabled={loading}
        >
          Approve & Merge
        </Button>
        <Button
          variant="default"
          onClick={handleRequestChanges}
          disabled={loading}
        >
          {showComments ? 'Submit Changes' : 'Request Changes'}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={loading}
        >
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
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
        />
      )}
    </div>
  );
}
