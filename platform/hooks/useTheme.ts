import { useTheme as useThemeBase } from 'next-themes'

export default function useTheme() {
  const { theme, forcedTheme, resolvedTheme, ...rest } = useThemeBase()

  return {
    ...rest,

    // @note resolvedTheme maps "system" to light or dark; consumers compare
    // against those two values only
    theme: forcedTheme || resolvedTheme || theme,

    resolvedTheme,

    forcedTheme,
  }
}
