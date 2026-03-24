import { create } from 'zustand';
import { api } from '../api/client';
import type { Slot } from '../lib/types';

interface SlotState {
  slots: Slot[];
  loading: boolean;
  fetchSlots: () => Promise<void>;
  updateSlotInStore: (slot: Slot) => void;
}

export const useSlotStore = create<SlotState>((set) => ({
  slots: [],
  loading: false,

  fetchSlots: async () => {
    set({ loading: true });
    try {
      const slots = await api.get<Slot[]>('/slots');
      set({ slots, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateSlotInStore: (slot) => {
    set((state) => {
      const idx = state.slots.findIndex((s) => s.id === slot.id);
      if (idx >= 0) {
        const updated = [...state.slots];
        updated[idx] = slot;
        return { slots: updated };
      }
      return { slots: [...state.slots, slot] };
    });
  },
}));
