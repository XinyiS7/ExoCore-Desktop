import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        mono: ['var(--font-code)'],
      },
      colors: {
        cinder: {
          base:        'var(--cinder-base)',
          ember:       'var(--cinder-ember)',
          'ember-dim': 'var(--cinder-ember-dim)',
          flame:       'var(--cinder-flame)',
          'flame-dim': 'var(--cinder-flame-dim)',
          glass:       'var(--cinder-glass)',
          line:        'var(--cinder-line)',
          'line-glow': 'var(--cinder-line-glow)',
          text:        'var(--cinder-text)',
          'text-dim':  'var(--cinder-text-dim)',
          'text-faint':'var(--cinder-text-faint)',
        },
      },
    },
  },
  plugins: [typography],
};
