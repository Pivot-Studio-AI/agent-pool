import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../shared/Button';

interface ApprovalControlsProps {
  taskId: string;
  planId: string;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  loading?: boolean;
}

export function ApprovalControls({
  taskId,
  planId,
  onApprove,
  onReject,
  loading = false,
}: ApprovalControlsProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleReject = () => {
    if (!showFeedback) {
      setShowFeedback(true);
      return;
    }
    const trimmed = feedback.trim();
    if (!trimmed) return;
    onReject(trimmed);
    setFeedback('');
    setShowFeedback(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="success"
          onClick={onApprove}
          loading={loading}
          disabled={loading}
        >
          <Check size={15} className="mr-0.5" />
          Approve Plan
        </Button>
        <Button
          variant="danger"
          onClick={handleReject}
          disabled={loading}
        >
          <X size={15} className="mr-0.5" />
          {showFeedback ? 'Submit Rejection' : 'Reject with Feedback'}
        </Button>
        {showFeedback && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setShowFeedback(false);
              setFeedback('');
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {showFeedback && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Explain why you're rejecting this plan and what changes you'd like..."
          rows={4}
          autoFocus
          className="w-full bg-surface border border-border/60 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 resize-none"
        />
      )}
    </div>
  );
}
