import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test the pure logic extracted from theme-store.ts

type Theme = 'dark' | 'light';

function getInitialTheme(storedValue: string | null): Theme {
  if (storedValue === 'light' || storedValue === 'dark') return storedValue;
  return 'dark';
}

function applyTheme(theme: Theme, root: { classList: { add: (c: string) => void; remove: (c: string) => void } }) {
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
}

function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

describe('theme-store logic', () => {
  describe('getInitialTheme()', () => {
    it('should return dark when no stored value', () => {
      expect(getInitialTheme(null)).toBe('dark');
    });

    it('should return dark when stored value is invalid', () => {
      expect(getInitialTheme('blue')).toBe('dark');
      expect(getInitialTheme('')).toBe('dark');
    });

    it('should return stored dark theme', () => {
      expect(getInitialTheme('dark')).toBe('dark');
    });

    it('should return stored light theme', () => {
      expect(getInitialTheme('light')).toBe('light');
    });
  });

  describe('applyTheme()', () => {
    it('should add light and remove dark for light theme', () => {
      const root = { classList: { add: vi.fn(), remove: vi.fn() } };
      applyTheme('light', root);
      expect(root.classList.add).toHaveBeenCalledWith('light');
      expect(root.classList.remove).toHaveBeenCalledWith('dark');
    });

    it('should add dark and remove light for dark theme', () => {
      const root = { classList: { add: vi.fn(), remove: vi.fn() } };
      applyTheme('dark', root);
      expect(root.classList.add).toHaveBeenCalledWith('dark');
      expect(root.classList.remove).toHaveBeenCalledWith('light');
    });
  });

  describe('toggleTheme()', () => {
    it('should toggle from dark to light', () => {
      expect(toggleTheme('dark')).toBe('light');
    });

    it('should toggle from light to dark', () => {
      expect(toggleTheme('light')).toBe('dark');
    });

    it('should round-trip back to original', () => {
      const original: Theme = 'dark';
      expect(toggleTheme(toggleTheme(original))).toBe(original);
    });
  });
});
