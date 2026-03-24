import { create } from 'zustand';
import { api } from '../api/client';
import type { Task } from '../lib/types';

interface TaskState {
  tasks: Record<string, Task>;
  selectedTaskId: string | null;
  loading: boolean;
  fetchTasks: () => Promise<void>;
  createTask: (data: {
    title: string;
    description?: string;
    priority?: string;
    target_branch?: string;
    model_tier?: string;
  }) => Promise<Task>;
  selectTask: (id: string | null) => void;
  updateTaskInStore: (task: Task) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  selectedTaskId: null,
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await api.get<Task[]>('/tasks?limit=100');
      const record: Record<string, Task> = {};
      for (const task of tasks) {
        record[task.id] = task;
      }
      set({ tasks: record, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createTask: async (data) => {
    const task = await api.post<Task>('/tasks', data);
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
    return task;
  },

  selectTask: (id) => {
    set({ selectedTaskId: id });
  },

  updateTaskInStore: (task) => {
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
  },
}));

// Selector helpers
export function getAttentionTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter(
    (t) => t.status === 'awaiting_approval' || t.status === 'awaiting_review'
  );
}

export function getActiveTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter((t) => t.status === 'executing');
}

export function getQueuedTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter((t) => t.status === 'queued');
}

export function getRecentTasks(state: TaskState): Task[] {
  return Object.values(state.tasks)
    .filter(
      (t) =>
        t.status === 'completed' ||
        t.status === 'rejected' ||
        t.status === 'errored'
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);
}
