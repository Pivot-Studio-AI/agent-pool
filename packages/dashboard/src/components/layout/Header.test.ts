import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Header.tsx'), 'utf-8');

describe('Header component', () => {
  it('should use glass utility for frosted header background', () => {
    expect(source).toContain('glass');
  });

  it('should use border-border/60 for subtle border', () => {
    expect(source).toContain('border-border/60');
  });

  it('should use gradient background for logo icon', () => {
    expect(source).toContain('bg-gradient-to-br from-accent/20 to-purple/20');
  });

  it('should add ring-1 ring-accent/20 to logo icon', () => {
    expect(source).toContain('ring-1 ring-accent/20');
  });

  it('should use animate-ping for connected indicator', () => {
    expect(source).toContain('animate-ping');
    expect(source).toContain('isConnected && (');
  });

  it('should show Live or Offline text based on connection', () => {
    expect(source).toContain("isConnected ? 'Live' : 'Offline'");
  });

  it('should render SlotIndicator, ThemeToggle, and UserMenu', () => {
    expect(source).toContain('<SlotIndicator');
    expect(source).toContain('<ThemeToggle');
    expect(source).toContain('<UserMenu');
  });
});
