import { useEffect } from 'react';
import { useTaskStore } from '../stores/task-store';

export function useTasks() {
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  useEffect(() => {
    fetchTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { tasks, loading, selectedTaskId };
}
