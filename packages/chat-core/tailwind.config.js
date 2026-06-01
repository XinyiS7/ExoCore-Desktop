import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        chat: {
          bg:    '#0a0a0f',
          panel: '#111118',
          border:'rgba(255,255,255,0.06)',
          accent:'#c0392b',
          'accent-glow': '#e74c3c',
          text:  '#e2e8f0',
          muted: '#64748b',
        }
      },
      boxShadow: {
        'glow-accent': '0 0 1px #c0392b, 0 0 8px rgba(192,57,43,0.6), 0 0 20px rgba(192,57,43,0.2)',
      },
    },
  },
  plugins: [typography],
}
