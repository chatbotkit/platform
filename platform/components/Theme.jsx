'use client'

import { ThemeProvider } from 'next-themes'

import ThemeColor from '@/components/ThemeColor'

import useScopedQuerySessionOption from '@/hooks/useScopedQuerySessionOption'

const availableThemes = ['none', 'light', 'dark']

function getForcedTheme(forcedTheme) {
  return availableThemes.includes(forcedTheme) ? forcedTheme : null
}

export default function Theme({ themes = availableThemes, theme, children }) {
  const queryForcedTheme = useScopedQuerySessionOption('_theme')

  const effectiveForcedTheme = getForcedTheme(queryForcedTheme) || theme

  return (
    <ThemeProvider
      attribute="class"
      themes={themes}
      defaultTheme="system"
      forcedTheme={effectiveForcedTheme}
      enableSystem={true}
      enableColorScheme={true}
      disableTransitionOnChange={true}
    >
      <ThemeColor />
      {children}
    </ThemeProvider>
  )
}
