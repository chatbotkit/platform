export const localeToLocaleMap: Record<string, string> = {
  en: 'en_US',
}

/**
 * Maps a given locale to a supported locale.
 */
export function getLocale(locale: string): string {
  locale = locale.replace(/-/g, '_')

  locale = localeToLocaleMap[locale] || locale

  return locale
}
