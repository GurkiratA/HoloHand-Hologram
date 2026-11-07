/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        holo: {
          bg: '#0b0f1a',
          panel: 'rgba(14,18,30,0.82)',
          line: 'rgba(255,255,255,0.08)',
          cyan: '#3ff0e0',
          teal: '#19c3b5',
          purple: '#a98bff',
          yellow: '#ffd84a',
          pink: '#ff8fc8',
          muted: '#8a93a8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,216,74,0.35), 0 0 18px rgba(255,216,74,0.15)',
        cyan: '0 0 0 1px rgba(63,240,224,0.35), 0 0 18px rgba(63,240,224,0.18)',
      },
    },
  },
  plugins: [],
};
