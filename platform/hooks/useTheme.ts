import { useTheme as useThemeBase } from 'next-themes'

export default function useTheme() {
  const { theme, forcedTheme, ...rest } = useThemeBase()

  return {
    ...rest,

    theme: forcedTheme || theme,

    forcedTheme,
  }
}
