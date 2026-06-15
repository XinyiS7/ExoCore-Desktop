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
        // Legacy exo-* design-system classes — mapped to Cinder palette.
        // Hex / rgb() values (not var()) so Tailwind opacity modifiers work.
        exo: {
          pure:       '#080808',
          accent:     '#ff4a08',
          muted:      'rgb(156 156 170)',
          text:       '#cecdd6',
          bg:         '#050505',
          panel:      'rgba(255,255,255,0.02)',
          surface:    'rgba(255,255,255,0.015)',
          metal:      '#121418',
          border:     'rgba(139,0,0,0.25)',
          accentGlow: '#ff6a28',
          mist: {
            8:  'rgba(139,0,0,0.08)',
            10: 'rgba(139,0,0,0.10)',
            12: 'rgba(139,0,0,0.12)',
            20: 'rgba(139,0,0,0.20)',
          },
        },
        // Legacy chat-* design-system classes — same mapping.
        chat: {
          accent: '#ff4a08',
          muted:  'rgb(156 156 170)',
          text:   '#cecdd6',
          panel:  'rgba(255,255,255,0.02)',
          bg:     '#050505',
        },
      },
    },
  },
  plugins: [typography],
};
