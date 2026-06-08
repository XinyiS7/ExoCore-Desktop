import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-system)'],
        mono: ['var(--font-code)'],
      },
      colors: {
        chat: {
          bg:    '#171720',
          panel: '#1a1a23',
          border:'rgba(255,255,255,0.06)',
          accent:'#c0392b',
          'accent-glow': '#e74c3c',
          text:  '#e2e8f0',
          muted: '#64748b',
        },
        // V2 compat aliases — remove after migrating components to chat-* palette
        exo: {
          bg:      '#0a0a0f',
          panel:   '#111118',
          pure:    '#0f0f1b',
          surface: '#0d0d14',
          border:  'rgba(255,255,255,0.06)',
          accent:  '#c0392b',
          text:    '#e2e8f0',
          muted:   '#64748b',
          metal:   '#334155',
          'mist-4':  'rgba(255,255,255,0.04)',
          'mist-6':  'rgba(255,255,255,0.06)',
          'mist-8':  'rgba(255,255,255,0.08)',
          'mist-10': 'rgba(255,255,255,0.10)',
          'mist-12': 'rgba(255,255,255,0.12)',
          'mist-15': 'rgba(255,255,255,0.15)',
          'mist-20': 'rgba(255,255,255,0.20)',
          'mist-25': 'rgba(255,255,255,0.25)',
          'mist-30': 'rgba(255,255,255,0.30)',
        },
      },
      boxShadow: {
        'glow-accent': '0 0 1px #c0392b, 0 0 8px rgba(192,57,43,0.6), 0 0 20px rgba(192,57,43,0.2)',
      },
    },
  },
  plugins: [typography],
}
