import { clsx } from 'clsx';
import { useSlotStore } from '../../stores/slot-store';
import type { SlotStatus } from '../../lib/types';

const dotStyles: Record<SlotStatus, string> = {
  idle: 'bg-text-muted/30',
  claimed: 'bg-green shadow-glow-green',
  active: 'bg-green shadow-glow-green animate-pulse-subtle',
  cleaning: 'bg-amber',
  quarantined: 'bg-red',
};

export function SlotIndicator() {
  const slots = useSlotStore((s) => s.slots);

  if (slots.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {slots.map((slot) => (
        <div
          key={slot.id}
          title={`Slot ${slot.slot_number}: ${slot.status}${slot.branch_name ? ` (${slot.branch_name})` : ''}`}
          className={clsx('w-2 h-2 rounded-full', dotStyles[slot.status] ?? 'bg-text-muted/30')}
        />
      ))}
    </div>
  );
}
