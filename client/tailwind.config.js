/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // 'Twemoji Country Flags' is unicode-range scoped to flag emoji
        // codepoints only — it doesn't affect text rendering, just supplies
        // colored flag glyphs on Windows browsers.
        display: ['Twemoji Country Flags', 'Plus Jakarta Sans', 'sans-serif'],
        body: ['Twemoji Country Flags', 'Inter', 'sans-serif'],
        mono: ['Twemoji Country Flags', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f6fb',
          100: '#deeaf5',
          200: '#b9d3ea',
          300: '#88b4d9',
          400: '#5a94c3',
          500: '#4a7fa7',
          600: '#3d6d93',
          700: '#325b7c',
          800: '#284b66',
          900: '#1e3c52',
        },
        navy: '#0A1B31',
        credit: '#F59E0B',
      },
      animation: {
        'pulse-green': 'pulse-green 1.5s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite linear',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
