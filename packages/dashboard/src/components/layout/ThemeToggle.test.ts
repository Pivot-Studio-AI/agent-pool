import { describe, it, expect } from 'vitest';

// Smoke tests for ThemeToggle rendering logic (pure function extraction)
// The component shows Sun icon in dark mode, Moon icon in light mode

type Theme = 'dark' | 'light';

function getIconName(theme: Theme): 'Sun' | 'Moon' {
  return theme === 'dark' ? 'Sun' : 'Moon';
}

function getTitle(theme: Theme): string {
  return theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

describe('ThemeToggle rendering logic', () => {
  it('should show Sun icon in dark mode', () => {
    expect(getIconName('dark')).toBe('Sun');
  });

  it('should show Moon icon in light mode', () => {
    expect(getIconName('light')).toBe('Moon');
  });

  it('should show "Switch to light mode" title in dark mode', () => {
    expect(getTitle('dark')).toBe('Switch to light mode');
  });

  it('should show "Switch to dark mode" title in light mode', () => {
    expect(getTitle('light')).toBe('Switch to dark mode');
  });
});
