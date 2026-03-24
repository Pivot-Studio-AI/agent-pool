import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskStore } from '../../stores/task-store';
import { Button } from '../shared/Button';

export function TaskCreator() {
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [targetBranch, setTargetBranch] = useState('main');
  const [modelTier, setModelTier] = useState('default');
  const [loading, setLoading] = useState(false);
  const createTask = useTaskStore((s) => s.createTask);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      await createTask({
        title: trimmed,
        ...(expanded && {
          description: description.trim() || undefined,
          priority,
          target_branch: targetBranch,
          model_tier: modelTier,
        }),
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTargetBranch('main');
      setModelTier('default');
      setExpanded(false);
    } catch {
      // Could show error toast here
    } finally {
      setLoading(false);
    }
  }, [title, expanded, description, priority, targetBranch, modelTier, loading, createTask]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 max-w-xl mx-4">
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-secondary transition-colors"
            aria-label={expanded ? 'Collapse task form' : 'Expand task form'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a task..."
            disabled={loading}
            className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          />
        </div>

        {expanded && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-lg p-4 space-y-3 z-50 shadow-xl">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Target Branch</label>
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Model Tier</label>
                <select
                  value={modelTier}
                  onChange={(e) => setModelTier(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="default">Default</option>
                  <option value="fast">Fast</option>
                  <option value="powerful">Powerful</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more detail about the task..."
                rows={3}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                loading={loading}
                disabled={!title.trim()}
                onClick={handleSubmit}
              >
                Create Task
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
