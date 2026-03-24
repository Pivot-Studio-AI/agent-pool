import { create } from 'zustand';
import { api } from '../api/client';
import type { AppEvent } from '../lib/types';

interface EventState {
  events: AppEvent[];
  loading: boolean;
  hasMore: boolean;
  fetchEvents: (limit?: number, before?: string) => Promise<void>;
  prependEvent: (event: AppEvent) => void;
  loadMore: () => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  hasMore: true,

  fetchEvents: async (limit = 20, before?: string) => {
    set({ loading: true });
    try {
      let path = `/events?limit=${limit}`;
      if (before) {
        path += `&before=${encodeURIComponent(before)}`;
      }
      const events = await api.get<AppEvent[]>(path);
      if (before) {
        // Appending older events
        set((state) => ({
          events: [...state.events, ...events],
          loading: false,
          hasMore: events.length === limit,
        }));
      } else {
        // Initial fetch
        set({
          events,
          loading: false,
          hasMore: events.length === limit,
        });
      }
    } catch {
      set({ loading: false });
    }
  },

  prependEvent: (event) => {
    set((state) => ({
      events: [event, ...state.events],
    }));
  },

  loadMore: async () => {
    const { events, hasMore, loading } = get();
    if (!hasMore || loading) return;
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      await get().fetchEvents(20, lastEvent.created_at);
    }
  },
}));
