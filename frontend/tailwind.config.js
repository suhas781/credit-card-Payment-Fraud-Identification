/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        'fs-bg': '#0a0f1e',
        'fs-card': '#111827',
        'fs-primary': '#6366f1',
        'fs-fraud': '#ef4444',
        'fs-legit': '#22c55e',
        'fs-text': '#f9fafb',
      },
    },
  },
  plugins: [],
}
