import { clsx } from 'clsx';
import { useSlotStore } from '../../stores/slot-store';
import type { SlotStatus } from '../../lib/types';

const dotStyles: Record<SlotStatus, string> = {
  idle: 'bg-text-muted/20',
  claimed: 'bg-green border border-green/40',
  active: 'bg-green border border-green/40 animate-pulse-subtle',
  cleaning: 'bg-amber border border-amber/40',
  quarantined: 'bg-red border border-red/40',
};

export function SlotIndicator() {
  const slots = useSlotStore((s) => s.slots);

  if (slots.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {slots.map((slot) => (
        <div
          key={slot.id}
          title={`Slot ${slot.slot_number}: ${slot.status}${slot.branch_name ? ` (${slot.branch_name})` : ''}`}
          className={clsx('w-2 h-2', dotStyles[slot.status] ?? 'bg-text-muted/20')}
        />
      ))}
    </div>
  );
}
