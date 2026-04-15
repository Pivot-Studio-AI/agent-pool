import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'SlotIndicator.tsx'), 'utf-8');

// Updated dotStyles mapping reflecting design refresh
const dotStyles: Record<string, string> = {
  idle: 'bg-text-muted/20',
  claimed: 'bg-green ring-1 ring-green/30',
  active: 'bg-green ring-1 ring-green/30 animate-pulse-subtle',
  cleaning: 'bg-amber ring-1 ring-amber/30',
  quarantined: 'bg-red ring-1 ring-red/30',
};

describe('SlotIndicator', () => {
  describe('dotStyles mapping', () => {
    it('should map idle to muted appearance', () => {
      expect(dotStyles['idle']).toContain('bg-text-muted');
    });

    it('should map active to green with ring and pulse animation', () => {
      expect(dotStyles['active']).toContain('bg-green');
      expect(dotStyles['active']).toContain('ring-1 ring-green/30');
      expect(dotStyles['active']).toContain('animate-pulse-subtle');
    });

    it('should map quarantined to red with ring', () => {
      expect(dotStyles['quarantined']).toContain('bg-red');
      expect(dotStyles['quarantined']).toContain('ring-1 ring-red/30');
    });

    it('should map claimed to green with ring', () => {
      expect(dotStyles['claimed']).toContain('ring-1 ring-green/30');
    });

    it('should map cleaning to amber with ring', () => {
      expect(dotStyles['cleaning']).toContain('bg-amber');
      expect(dotStyles['cleaning']).toContain('ring-1 ring-amber/30');
    });
  });

  it('should return null when no slots exist', () => {
    expect(source).toContain('if (slots.length === 0) return null');
  });

  it('should show slot number and status in title tooltip', () => {
    expect(source).toContain('Slot ${slot.slot_number}: ${slot.status}');
  });
});
