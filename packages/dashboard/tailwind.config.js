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
        'surface-raised': 'var(--color-surface-raised)',
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
        'none': '0px',
      },
    },
  },
  plugins: [],
};
