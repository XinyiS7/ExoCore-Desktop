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
        cinder: {
          base:        'var(--cinder-base)',
          ember:       'var(--cinder-ember)',
          'ember-dim': 'var(--cinder-ember-dim)',
          flame:       'var(--cinder-flame)',
          'flame-dim': 'var(--cinder-flame-dim)',
          glass:       'var(--cinder-glass)',
          'glass-heavy':'var(--cinder-glass-heavy)',
          line:        'var(--cinder-line)',
          'line-glow': 'var(--cinder-line-glow)',
          panel:       'var(--cinder-panel)',
          surface:     'var(--cinder-surface)',
          text:        'var(--cinder-text)',
          'text-dim':  'var(--cinder-text-dim)',
          'text-faint':'var(--cinder-text-faint)',
        },
        // Legacy exo-* design-system classes — bridged to CSS variables for theme switching.
        // rgb(var / calc(alpha * <alpha-value>)) pattern preserves Tailwind opacity modifiers.
        exo: {
          pure:       'rgb(var(--exo-pure-rgb) / <alpha-value>)',
          accent:     'rgb(var(--exo-accent-rgb) / <alpha-value>)',
          muted:      'rgb(var(--exo-muted-rgb) / <alpha-value>)',
          text:       'rgb(var(--exo-text-rgb) / <alpha-value>)',
          bg:         'rgb(var(--exo-bg-rgb) / <alpha-value>)',
          panel:      'rgb(var(--exo-panel-rgb) / calc(var(--exo-panel-alpha) * <alpha-value>))',
          surface:    'rgb(var(--exo-surface-rgb) / calc(var(--exo-surface-alpha) * <alpha-value>))',
          metal:      'rgb(var(--exo-metal-rgb) / <alpha-value>)',
          border:     'rgb(var(--exo-border-rgb) / calc(var(--exo-border-alpha) * <alpha-value>))',
          accentGlow: 'rgb(var(--exo-accentGlow-rgb) / <alpha-value>)',
          mist: {
            8:  'rgb(var(--exo-mist-rgb) / calc(0.08 * <alpha-value>))',
            10: 'rgb(var(--exo-mist-rgb) / calc(0.10 * <alpha-value>))',
            12: 'rgb(var(--exo-mist-rgb) / calc(0.12 * <alpha-value>))',
            20: 'rgb(var(--exo-mist-rgb) / calc(0.20 * <alpha-value>))',
          },
        },
        // Legacy chat-* design-system classes — same bridge pattern.
        chat: {
          accent: 'rgb(var(--chat-accent-rgb) / <alpha-value>)',
          muted:  'rgb(var(--chat-muted-rgb) / <alpha-value>)',
          text:   'rgb(var(--chat-text-rgb) / <alpha-value>)',
          panel:  'rgb(var(--chat-panel-rgb) / calc(var(--chat-panel-alpha) * <alpha-value>))',
          bg:     'rgb(var(--chat-bg-rgb) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [typography],
};
