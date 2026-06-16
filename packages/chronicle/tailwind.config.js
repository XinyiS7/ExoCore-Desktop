export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-system)'],
        mono: ['var(--font-code)'],
      },
      colors: {
        chron: {
          bg:     '#faf6f0',
          panel:  '#fffdf8',
          border: 'rgba(139, 90, 43, 0.10)',
          accent: '#a0522d',
          text:   '#3d2b1f',
          muted:  '#8b7355',
        },
        // V2 compat aliases — map to chron palette
        exo: {
          bg:      '#faf6f0',
          panel:   '#fffdf8',
          pure:    '#faf4ea',
          surface: '#f5efe5',
          border:  'rgba(139, 90, 43, 0.10)',
          accent:  '#a0522d',
          text:    '#3d2b1f',
          muted:   '#8b7355',
          metal:   '#a09080',
          'mist-4':  'rgba(139, 90, 43, 0.04)',
          'mist-6':  'rgba(139, 90, 43, 0.06)',
          'mist-8':  'rgba(139, 90, 43, 0.08)',
          'mist-10': 'rgba(139, 90, 43, 0.10)',
          'mist-12': 'rgba(139, 90, 43, 0.12)',
          'mist-15': 'rgba(139, 90, 43, 0.15)',
          'mist-20': 'rgba(139, 90, 43, 0.20)',
          'mist-25': 'rgba(139, 90, 43, 0.25)',
          'mist-30': 'rgba(139, 90, 43, 0.30)',
        },
      },
    },
  },
  plugins: [],
}
