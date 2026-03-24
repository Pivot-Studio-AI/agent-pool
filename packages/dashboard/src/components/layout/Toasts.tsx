import { useToastStore } from '../../stores/toast-store';
import { useTaskStore } from '../../stores/task-store';

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const selectTask = useTaskStore((s) => s.selectTask);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-surface border border-border rounded-lg p-3 shadow-lg cursor-pointer hover:border-accent/50 transition-colors"
          onClick={() => {
            if (toast.taskId) {
              selectTask(toast.taskId);
            }
            removeToast(toast.id);
          }}
        >
          <p className="text-text-primary text-xs">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
