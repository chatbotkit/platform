/**
 * Checks if a string is a valid template name
 */
export function isTemplateName(name: string): boolean {
  name = name.trim()

  return name.startsWith('@') && !/\s/.test(name)
}

/**
 * Checks if a template is a platform template
 */
export function isPlatformTemplate(name: string): boolean {
  return getTemplateRealName(name).startsWith('platform/')
}

/**
 * Gets the real name of a template by removing the @ prefix and normalizing
 */
export function getTemplateRealName(name: string): string {
  return name.toLowerCase().trim().replace(/^@/, '')
}

/**
 * Gets a template from a catalogue by name
 */
export function getTemplate<T>(
  name: string | null | undefined,
  catalogue: Record<string, T>
): T | null {
  if (!name) {
    return null
  }

  const realName = getTemplateRealName(name)

  return catalogue[realName] || null
}
