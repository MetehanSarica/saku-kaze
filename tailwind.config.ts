import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Saku Kaze palette
        'sk-bg':       '#0d1117',
        'sk-surface':  '#161b22',
        'sk-border':   '#21262d',
        'sk-text':     '#c9d1d9',
        'sk-muted':    '#6e7681',
        'sk-accent':   '#58a6ff',
        'sk-pink':     '#f0a0b0',
        'sk-blue':     '#7dcfff',
      },
    },
  },
  plugins: [],
};

export default config;
