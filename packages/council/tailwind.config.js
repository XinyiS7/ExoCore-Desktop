export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        mono: ['var(--font-code)'],
      },
      colors: {
        cncl: {
          bg:     '#0d1117',
          panel:  '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          text:   '#c9d1d9',
          muted:  '#8b949e',
          grid:   'rgba(88,166,255,0.12)',
        }
      },
    },
  },
  plugins: [],
}
