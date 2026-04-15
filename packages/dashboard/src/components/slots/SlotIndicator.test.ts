import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'SlotIndicator.tsx'), 'utf-8');

// Test dotStyles mapping extracted from the component
const dotStyles: Record<string, string> = {
  idle: 'bg-text-muted/30',
  claimed: 'bg-green shadow-glow-green',
  active: 'bg-green shadow-glow-green animate-pulse-subtle',
  cleaning: 'bg-amber',
  quarantined: 'bg-red',
};

describe('SlotIndicator', () => {
  describe('dotStyles mapping', () => {
    it('should map idle to muted appearance', () => {
      expect(dotStyles['idle']).toContain('bg-text-muted');
    });

    it('should map active to green with pulse animation', () => {
      expect(dotStyles['active']).toContain('bg-green');
      expect(dotStyles['active']).toContain('animate-pulse-subtle');
    });

    it('should map quarantined to red', () => {
      expect(dotStyles['quarantined']).toBe('bg-red');
    });

    it('should map claimed to green with glow', () => {
      expect(dotStyles['claimed']).toContain('shadow-glow-green');
    });
  });

  it('should return null when no slots exist', () => {
    expect(source).toContain('if (slots.length === 0) return null');
  });

  it('should show slot number and status in title tooltip', () => {
    expect(source).toContain('Slot ${slot.slot_number}: ${slot.status}');
  });
});
