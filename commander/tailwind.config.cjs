/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#121412',
        panel: '#191c19',
        raised: '#222622',
        line: '#353a35',
        ink: '#f0eee7',
        muted: '#9da39a',
        signal: '#e8a72c',
        danger: '#d94a3a',
        success: '#6ea66d',
        warning: '#c98b27'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      }
    }
  },
  plugins: []
};

