import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    '#07070f',
        pit:     '#0c0c18',
        cave:    '#10101c',
        surface: '#151525',
        dim:     '#1b1b2e',
        wire:    '#222238',
        accent: {
          DEFAULT: '#7c6af7',
          muted:   '#3d3494',
        },
        ink: {
          bright: '#ddddf4',
          base:   '#8888b0',
          dim:    '#4c4c6a',
          muted:  '#252538',
        },
        signal: {
          ok:   '#3dd68c',
          fail: '#ff6b6b',
          warn: '#fbbf24',
        },
      },
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        blink:    'blink 1s step-end infinite',
        'fade-up': 'fadeUp 0.25s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config
