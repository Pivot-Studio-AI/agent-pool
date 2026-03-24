import { useEffect } from 'react';
import { useSlotStore } from '../stores/slot-store';

export function useSlots() {
  const slots = useSlotStore((s) => s.slots);
  const loading = useSlotStore((s) => s.loading);
  const fetchSlots = useSlotStore((s) => s.fetchSlots);

  useEffect(() => {
    fetchSlots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { slots, loading };
}
