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
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchSlots = useSlotStore((s) => s.fetchSlots);
  const fetchEvents = useEventStore((s) => s.fetchEvents);

  useEffect(() => {
    fetchTasks();
    fetchSlots();
    fetchEvents();
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
