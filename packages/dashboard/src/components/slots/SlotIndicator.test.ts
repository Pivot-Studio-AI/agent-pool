import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'SlotIndicator.tsx'), 'utf-8');

describe('SlotIndicator', () => {
  it('should use border instead of ring for dot styles', () => {
    expect(source).toContain('border border-green/40');
    expect(source).toContain('border border-amber/40');
    expect(source).toContain('border border-red/40');
    expect(source).not.toContain('ring-1');
  });

  it('should map idle to muted appearance', () => {
    expect(source).toContain('bg-text-muted/20');
  });

  it('should map active to green with pulse animation', () => {
    expect(source).toContain("active: 'bg-green border border-green/40 animate-pulse-subtle'");
  });

  it('should return null when no slots exist', () => {
    expect(source).toContain('if (slots.length === 0) return null');
  });

  it('should show slot number and status in title tooltip', () => {
    expect(source).toContain('Slot ${slot.slot_number}: ${slot.status}');
  });
});
