/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-glow': 'var(--color-accent-glow)',
        green: 'var(--color-green)',
        'green-glow': 'var(--color-green-glow)',
        amber: 'var(--color-amber)',
        'amber-glow': 'var(--color-amber-glow)',
        red: 'var(--color-red)',
        'red-glow': 'var(--color-red-glow)',
        purple: 'var(--color-purple)',
        'purple-glow': 'var(--color-purple-glow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'glow-accent': '0 0 20px var(--color-accent-glow)',
        'glow-green': '0 0 20px var(--color-green-glow)',
        'glow-amber': '0 0 20px var(--color-amber-glow)',
        'glow-red': '0 0 20px var(--color-red-glow)',
        'glow-purple': '0 0 20px var(--color-purple-glow)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--color-border)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--color-border)',
      },
    },
  },
  plugins: [],
};
