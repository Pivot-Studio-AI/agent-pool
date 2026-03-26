import { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toasts } from './Toasts';
import { TaskInbox } from '../tasks/TaskInbox';
import { TaskDetail } from '../tasks/TaskDetail';
import { useTaskStore } from '../../stores/task-store';
import { useSlotStore } from '../../stores/slot-store';
import { useEventStore } from '../../stores/event-store';

interface ShellProps {
  isConnected: boolean;
}

export function Shell({ isConnected }: ShellProps) {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchSlots = useSlotStore((s) => s.fetchSlots);
  const fetchEvents = useEventStore((s) => s.fetchEvents);

  useEffect(() => {
    fetchTasks();
    fetchSlots();
    fetchEvents();

    // Restore task ID from URL on mount
    const match = window.location.pathname.match(/^\/tasks\/([a-f0-9-]+)/);
    if (match) {
      // Set directly without pushing to history (we're already on this URL)
      useTaskStore.setState({ selectedTaskId: match[1] });
    }

    // Handle browser back/forward
    const handlePopState = () => {
      const m = window.location.pathname.match(/^\/tasks\/([a-f0-9-]+)/);
      useTaskStore.setState({ selectedTaskId: m ? m[1] : null });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Header isConnected={isConnected} />
      <Sidebar />
      <main className="ml-64 pt-28 min-h-screen">
        {selectedTaskId ? (
          <TaskDetail />
        ) : (
          <TaskInbox />
        )}
      </main>
      <Toasts />
    </div>
  );
}
