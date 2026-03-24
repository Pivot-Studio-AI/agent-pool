import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  taskId?: string;
  timestamp: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, taskId?: string) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, taskId) => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, message, taskId, timestamp: Date.now() };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
