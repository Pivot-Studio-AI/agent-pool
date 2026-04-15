import { create } from 'zustand';
import { api } from '../api/client';
import { useAuthStore } from './auth-store';
import type { Task, Diff } from '../lib/types';

interface TaskState {
  tasks: Record<string, Task>;
  testStatus: Record<string, string>;
  selectedTaskId: string | null;
  loading: boolean;
  fetchTasks: () => Promise<void>;
  createTask: (data: {
    title: string;
    description?: string;
    priority?: string;
    target_branch?: string;
    model_tier?: string;
    attachments?: File[];
  }) => Promise<Task>;
  selectTask: (id: string | null) => void;
  updateTaskInStore: (task: Task) => void;
  setTestStatus: (taskId: string, status: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  testStatus: {},
  selectedTaskId: null,
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const selectedRepo = useAuthStore.getState().selectedRepo;
      let path = '/tasks?limit=100';
      if (selectedRepo?.id) {
        path += `&repo_id=${selectedRepo.id}`;
      }
      const tasks = await api.get<Task[]>(path);
      const record: Record<string, Task> = {};
      for (const task of tasks) {
        record[task.id] = task;
      }
      set({ tasks: record, loading: false });

      // Fetch test status for awaiting_review tasks
      const awaitingReview = tasks.filter((t) => t.status === 'awaiting_review');
      for (const task of awaitingReview) {
        api.get<Diff[]>(`/tasks/${task.id}/diffs`).then((diffs) => {
          const latest = diffs[diffs.length - 1];
          if (latest?.test_results?.status) {
            get().setTestStatus(task.id, latest.test_results.status);
          }
        }).catch(() => {});
      }
    } catch {
      set({ loading: false });
    }
  },

  createTask: async (data) => {
    const selectedRepo = useAuthStore.getState().selectedRepo;

    if (data.attachments && data.attachments.length > 0) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('title', data.title);
      if (data.description) formData.append('description', data.description);
      if (data.priority) formData.append('priority', data.priority);
      if (data.target_branch) formData.append('target_branch', data.target_branch);
      if (data.model_tier) formData.append('model_tier', data.model_tier);
      if (selectedRepo?.id) formData.append('repo_id', selectedRepo.id);

      data.attachments.forEach((file, index) => {
        formData.append(`attachments`, file);
      });

      const task = await api.postFormData<Task>('/tasks', formData);
      set((state) => ({
        tasks: { ...state.tasks, [task.id]: task },
      }));
      return task;
    } else {
      // Regular JSON request for tasks without attachments
      const body: Record<string, unknown> = { ...data };
      delete body.attachments;
      if (selectedRepo?.id) {
        body.repo_id = selectedRepo.id;
      }
      const task = await api.post<Task>('/tasks', body);
      set((state) => ({
        tasks: { ...state.tasks, [task.id]: task },
      }));
      return task;
    }
  },

  selectTask: (id) => {
    set({ selectedTaskId: id });
    // Sync to URL
    if (id) {
      window.history.pushState(null, '', `/tasks/${id}`);
    } else {
      window.history.pushState(null, '', '/');
    }
  },

  updateTaskInStore: (task) => {
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
  },

  setTestStatus: (taskId, status) => {
    set((state) => ({
      testStatus: { ...state.testStatus, [taskId]: status },
    }));
  },
}));

// Selector helpers
export function isTestsRunning(state: TaskState, taskId: string): boolean {
  return state.testStatus[taskId] === 'running';
}

export function getAttentionTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter(
    (t) =>
      t.status === 'awaiting_approval' ||
      (t.status === 'awaiting_review' && !isTestsRunning(state, t.id))
  );
}

export function getActiveTasks(state: TaskState): Task[] {
  return Object.values(state.tasks).filter(
    (t) =>
      t.status === 'executing' ||
      t.status === 'planning' ||
      t.status === 'merging' ||
      t.status === 'deploying' ||
      (t.status === 'awaiting_review' && isTestsRunning(state, t.id))
  );
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
        t.status === 'errored' ||
        t.status === 'cancelled'
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);
}
