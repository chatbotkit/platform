/* eslint-disable import/no-anonymous-default-export */
import tailwindcssContainerQueries from '@tailwindcss/container-queries'
import tailwindcssForms from '@tailwindcss/forms'
import tailwindcssTypography from '@tailwindcss/typography'

import tailwindGradientMaskImage from 'tailwind-gradient-mask-image'
import tailwindcssBgPatterns from 'tailwindcss-bg-patterns'
import tailwindcssHighlights from 'tailwindcss-highlights'
import tailwindcssMotion from 'tailwindcss-motion'
import tailwindcssTextRendering from 'tailwindcss-text-rendering'
import colors from 'tailwindcss/colors'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    './{components,hooks,contexts,layouts,pages,app}/**/*.{js,ts,jsx,tsx}',

    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',

    './lib/integration.items.js',
  ],

  darkMode: 'class',

  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },

      fontFamily: {
        // @note Apple-only keywords first (`-apple-system`, `BlinkMacSystemFont`
        // are inert off Apple) so macOS/iOS keep native San Francisco; Windows
        // and Linux fall through to Pretendard (an SF-alike). NOT `ui-sans-serif`
        // /`system-ui` here - those resolve on every OS and would shadow
        // Pretendard on Win/Linux. They still ride along at the tail of the
        // default stack as the last-ditch fallback. @font-face in globals.css.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Pretendard',
          ...defaultTheme.fontFamily.sans,
        ],
        mono: [...defaultTheme.fontFamily.mono],
      },

      keyframes: {
        'infinite-scroll': {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-100%, 0, 0)' },
        },

        'deg-rotate': {
          '0%': { ['--deg']: '0deg' },
          '100%': { ['--deg']: '360deg' },
        },

        'hue-rotate': {
          '0%': { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },

        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },

      animation: {
        'infinite-scroll': 'infinite-scroll 25s linear infinite',

        'deg-rotate': 'deg-rotate 3s linear infinite',

        'hue-rotate': 'hue-rotate 3s linear infinite',

        'fade-in': 'fade-in 0.5s ease-in-out',
      },

      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },

      backgroundImage: {
        'gradient-dynamic':
          'linear-gradient(var(--deg), var(--tw-gradient-stops))',
      },

      fontSize: {
        xxs: '0.688rem',
        xxxs: '0.625rem',
      },

      textShadow: {
        'solid-outline': [
          '-1px -1px 0 #000',
          '1px -1px 0 #000',
          '-1px 1px 0 #000',
          '1px 1px 0 #000',
        ].join(', '),
        'solid-outline-light': [
          '-1px -1px 0 rgba(255,255,255,0.8)',
          '1px -1px 0 rgba(255,255,255,0.8)',
          '-1px 1px 0 rgba(255,255,255,0.8)',
          '1px 1px 0 rgba(255,255,255,0.8)',
        ].join(', '),
      },

      typography: () => ({
        xs: {
          css: {
            'font-size': '0.875rem',
            'line-height': '1.5',
            'max-width': 'none',
          },
        },

        sizeless: {
          css: {
            'max-width': 'none',
          },
        },

        colorless: {
          css: {
            '--tw-prose-body': 'inherit',
            '--tw-prose-headings': 'inherit',
            '--tw-prose-lead': 'inherit',
            '--tw-prose-links': 'inherit',
            '--tw-prose-bold': 'inherit',
            '--tw-prose-counters': 'inherit',
            '--tw-prose-bullets': 'inherit',
            '--tw-prose-hr': 'inherit',
            '--tw-prose-quotes': 'inherit',
            '--tw-prose-quote-borders': 'inherit',
            '--tw-prose-captions': 'inherit',
            '--tw-prose-code': 'inherit',
            '--tw-prose-pre-code': 'inherit',
            '--tw-prose-pre-bg': 'inherit',
            '--tw-prose-th-borders': 'inherit',
            '--tw-prose-td-borders': 'inherit',
            '--tw-prose-invert-body': 'inherit',
            '--tw-prose-invert-headings': 'inherit',
            '--tw-prose-invert-lead': 'inherit',
            '--tw-prose-invert-links': 'inherit',
            '--tw-prose-invert-bold': 'inherit',
            '--tw-prose-invert-counters': 'inherit',
            '--tw-prose-invert-bullets': 'inherit',
            '--tw-prose-invert-hr': 'inherit',
            '--tw-prose-invert-quotes': 'inherit',
            '--tw-prose-invert-quote-borders': 'inherit',
            '--tw-prose-invert-captions': 'inherit',
            '--tw-prose-invert-code': 'inherit',
            '--tw-prose-invert-pre-code': 'inherit',
            '--tw-prose-invert-pre-bg': 'inherit',
            '--tw-prose-invert-th-borders': 'inherit',
            '--tw-prose-invert-td-borders': 'inherit',
          },
        },

        'inherit-text-properties': {
          css: {
            'font-size': 'inherit',
            'line-height': 'inherit',
          },
        },
      }),

      colors: {
        transparent: 'transparent',

        current: 'currentColor',

        // white: 'rgb(249, 250, 251)',
        // black: 'rgb(13, 17, 23)',

        white: '#fdfdfd',
        black: '#0a0a0a',

        gray: {
          50: colors.zinc[50],
          100: colors.zinc[100],
          200: colors.zinc[200],
          300: colors.zinc[300],
          400: colors.zinc[400],
          500: colors.zinc[500],
          600: colors.zinc[600],
          700: colors.zinc[700],
          800: colors.zinc[800],
          900: colors.zinc[900],
          950: colors.zinc[950],
        },

        // charts

        ...{
          tremor: {
            brand: {
              faint: colors.indigo[50],
              muted: colors.indigo[200],
              subtle: colors.indigo[400],
              DEFAULT: colors.indigo[500],
              emphasis: colors.indigo[700],
              inverted: colors.white,
            },
            background: {
              muted: colors.gray[50],
              subtle: colors.gray[100],
              DEFAULT: colors.white,
              emphasis: colors.gray[700],
            },
            border: {
              DEFAULT: colors.gray[200],
            },
            ring: {
              DEFAULT: colors.gray[200],
            },
            content: {
              subtle: colors.gray[400],
              DEFAULT: colors.gray[500],
              emphasis: colors.gray[700],
              strong: colors.gray[900],
              inverted: colors.white,
            },
          },

          'dark-tremor': {
            brand: {
              faint: '#0B1229',
              muted: colors.indigo[950],
              subtle: colors.indigo[800],
              DEFAULT: colors.indigo[500],
              emphasis: colors.indigo[400],
              inverted: colors.indigo[950],
            },
            background: {
              muted: '#131A2B',
              subtle: colors.gray[800],
              DEFAULT: colors.gray[900],
              emphasis: colors.gray[300],
            },
            border: {
              DEFAULT: colors.gray[800],
            },
            ring: {
              DEFAULT: colors.gray[800],
            },
            content: {
              subtle: colors.gray[600],
              DEFAULT: colors.gray[500],
              emphasis: colors.gray[200],
              strong: colors.gray[50],
              inverted: colors.gray[950],
            },
          },
        },
      },
    },
  },

  safelist: [
    {
      pattern:
        /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    },
    {
      pattern:
        /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    },
    {
      pattern:
        /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    },
    {
      pattern:
        /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],

  plugins: [
    tailwindcssForms,
    tailwindcssTypography,
    tailwindGradientMaskImage,
    tailwindcssBgPatterns,
    tailwindcssTextRendering,
    tailwindcssMotion,
    tailwindcssHighlights,
    tailwindcssContainerQueries,

    // @note text-shadow utilities driven by theme.textShadow; replaces the
    // tailwindcss-textshadow package, which dragged in a whole Tailwind 1 tree
    function ({ matchUtilities, theme }) {
      matchUtilities(
        { 'text-shadow': (value) => ({ textShadow: value }) },
        { values: theme('textShadow') }
      )
    },

    function ({ addVariant }) {
      addVariant('not-focus', '&:not(:focus)')
      addVariant('starting', '@starting-style')
    },
  ],
}
