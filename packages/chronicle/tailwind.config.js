export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      colors: {
        chron: {
          bg:     '#1a1a14',
          panel:  '#222218',
          border: 'rgba(255,255,255,0.05)',
          accent: '#c9a44b',
          text:   '#d4c5a9',
          muted:  '#7a7568',
        }
      },
    },
  },
  plugins: [],
}
