import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/theme-store';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/50 hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
