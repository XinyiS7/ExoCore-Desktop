export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        serif: ['Merriweather', 'Georgia', 'serif'],
        mono: ['var(--font-code)'],
      },
      colors: {
        chron: {
          bg:     '#1a1a14',
          panel:  '#222218',
          border: 'rgba(255,255,255,0.05)',
          accent: '#c9a44b',
          text:   '#d4c5a9',
          muted:  '#7a7568',
        },
        // V2 compat aliases — map to chron palette
        exo: {
          bg:      '#1a1a14',
          panel:   '#222218',
          pure:    '#161610',
          surface: '#1e1e18',
          border:  'rgba(255,255,255,0.05)',
          accent:  '#c9a44b',
          text:    '#d4c5a9',
          muted:   '#7a7568',
          metal:   '#5c574a',
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
    },
  },
  plugins: [],
}
