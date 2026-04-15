import { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
import { ChevronDown, ChevronRight, Paperclip, X, Image, Send } from 'lucide-react';
import { useTaskStore } from '../../stores/task-store';
import { Button } from '../shared/Button';

interface AttachmentFile {
  file: File;
  preview?: string;
}

export function TaskCreator() {
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [targetBranch, setTargetBranch] = useState('main');
  const [modelTier, setModelTier] = useState('default');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const addAttachmentRef = useRef<(file: File) => void>(() => {});
  const createTask = useTaskStore((s) => s.createTask);

  const addAttachment = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachments(prev => [...prev, {
        file,
        preview: reader.result as string
      }]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Keep ref in sync so the paste handler always uses the latest version
  addAttachmentRef.current = addAttachment;

  // Handle paste events for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste if title input is focused
      if (document.activeElement !== titleInputRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check if clipboard contains image files
      const imageFiles: File[] = [];
      let hasPlainText = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            imageFiles.push(blob);
          }
        }
        if (items[i].type === 'text/plain') {
          hasPlainText = true;
        }
      }

      if (imageFiles.length === 0) return;

      // If there's also plain text in the clipboard (e.g. copying from a webpage),
      // let the default paste handle the text and just add the images as attachments.
      // Only preventDefault when the clipboard has image-only content (e.g. screenshots).
      if (!hasPlainText) {
        e.preventDefault();
      }

      imageFiles.forEach(file => addAttachmentRef.current(file));
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(addAttachment);
  }, [addAttachment]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(addAttachment);

    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addAttachment]);

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
        attachments: attachments.map(a => a.file),
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTargetBranch('main');
      setModelTier('default');
      setAttachments([]);
      setExpanded(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      alert(`Failed to create task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [title, expanded, description, priority, targetBranch, modelTier, attachments, loading, createTask]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 max-w-xl mx-3">
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-secondary p-0.5 rounded"
            aria-label={expanded ? 'Collapse task form' : 'Expand task form'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div
            className="flex-1 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a task..."
              disabled={loading}
              className={`w-full bg-bg/60 border rounded-lg pl-3 pr-20 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/40 focus:bg-bg/80 disabled:opacity-50 ${
                dragOver ? 'border-accent bg-accent/5' : 'border-border/60'
              }`}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {attachments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-md hover:bg-accent/20 ring-1 ring-accent/20"
                  title="View attached images"
                >
                  <Image size={10} />
                  {attachments.length}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-text-muted hover:text-text-secondary p-1 rounded"
                title="Add image files"
              >
                <Paperclip size={13} />
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim() || loading}
                className="text-accent hover:text-accent/80 p-1 rounded disabled:opacity-30"
                title="Create task"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border/60 rounded-xl p-4 space-y-3 z-50 shadow-elevated animate-fade-in ring-1 ring-white/[0.03]">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Target Branch</label>
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-lg px-2 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent/40"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Model Tier</label>
                <select
                  value={modelTier}
                  onChange={(e) => setModelTier(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                >
                  <option value="default">Default</option>
                  <option value="fast">Fast</option>
                  <option value="powerful">Powerful</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more detail about the task..."
                rows={3}
                className="w-full bg-bg border border-border/60 rounded-lg px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/40 resize-none"
              />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div>
                <label className="block text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1.5">
                  Attachments ({attachments.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="w-14 h-14 object-cover rounded-lg border border-border/60 ring-1 ring-white/[0.03]"
                      />
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
