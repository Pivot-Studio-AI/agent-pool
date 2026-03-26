import { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
import { ChevronDown, ChevronRight, Paperclip, Upload, X, Image } from 'lucide-react';
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
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
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
    <div className="flex-1 max-w-2xl mx-4">
      <div className="relative">
        <div className="flex items-start gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-secondary transition-colors mt-2"
            aria-label={expanded ? 'Collapse task form' : 'Expand task form'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              placeholder="Describe a task... (paste images or drag & drop)"
              disabled={loading}
              rows={3}
              className={`w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all disabled:opacity-50 resize-none ${
                dragOver ? 'border-accent bg-accent/5' : ''
              }`}
            />
            <div className="absolute right-2 top-1.5 flex items-center gap-1">
              {attachments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-1 text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded hover:bg-accent/20 transition-colors"
                  title="View attached images"
                >
                  <Image size={12} />
                  {attachments.length}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-text-muted hover:text-text-secondary transition-colors p-1"
                title="Add image files"
              >
                <Paperclip size={14} />
              </button>
            </div>
          </div>
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

            {/* Attachments Preview — inside expanded panel, not in the header */}
            {attachments.length > 0 && (
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Attachments ({attachments.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="w-16 h-16 object-cover rounded border border-border"
                      />
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded-b truncate">
                        {attachment.file.name}
                      </div>
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
