import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toasts } from './Toasts';
import { TaskInbox } from '../tasks/TaskInbox';
import { TaskDetail } from '../tasks/TaskDetail';
import { useTaskStore } from '../../stores/task-store';

interface ShellProps {
  isConnected: boolean;
}

export function Shell({ isConnected }: ShellProps) {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Header isConnected={isConnected} />
      <Sidebar />
      <main className="ml-64 pt-14 min-h-screen">
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
