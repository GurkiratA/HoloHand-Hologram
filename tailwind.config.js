/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        holo: {
          bg: '#0a0b0e',
          panel: 'rgba(9,10,13,0.9)',
          line: 'rgba(255,255,255,0.1)',
          signal: '#a7b4ff',
          teal: '#19c3b5',
          purple: '#a98bff',
          accent: '#c8f560',
          pink: '#ff8fc8',
          muted: '#8b8f98',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,245,96,0.4)',
        signal: '0 0 0 1px rgba(167,180,255,0.4)',
      },
    },
  },
  plugins: [],
};
