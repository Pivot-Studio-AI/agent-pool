/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        'surface-hover': '#222632',
        border: '#2a2e3a',
        'text-primary': '#f0f2f5',
        'text-secondary': '#9ca3b0',
        'text-muted': '#5c6370',
        accent: '#6c8cff',
        green: '#4ade80',
        amber: '#fbbf24',
        red: '#f87171',
        purple: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
