/**
 * Brand logos that are monochrome: they read fine in light mode but vanish
 * against a dark background. `DynamicIcon` understands a `light;dark` split and
 * a `#filter=...` hash, so the dark-mode variant is inverted-grayscale, which
 * turns the dark mark light again.
 *
 * Keyed by the plain icon reference so the same lookup works wherever an icon
 * is about to be rendered - the designer's resource builders and the ability
 * list both feed their icons through {@link toThemeAwareIcon}.
 */
export const THEME_AWARE_ICON_MAP: Record<string, string> = {
  '@logo/chatbotkit.com':
    '@logo/chatbotkit.com;@logo/chatbotkit.com#filter=invertGrayscale',
}

/**
 * Swap a monochrome brand icon for its theme-aware variant. Anything not in the
 * map - including non-string component icons - is returned unchanged.
 */
export function toThemeAwareIcon<T>(icon: T): T | string {
  return typeof icon === 'string' ? THEME_AWARE_ICON_MAP[icon] ?? icon : icon
}
