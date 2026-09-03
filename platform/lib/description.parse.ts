/**
 * Parses a description field that may contain a markdown separator (---).
 *
 * When a description contains the separator, the text before it is treated
 * as the "short" description (used in listings and backstory), while the text
 * after it is treated as the "extended" description (injected when the
 * resource is installed/activated).
 *
 * This convention allows resources (skillsets, datasets, etc.) to have both
 * a concise description for quick understanding and token efficiency, and
 * a detailed description that provides rich context when needed.
 *
 * @example
 * ```typescript
 * // Description without separator - short and full are the same
 * parseDescription('A simple weather API')
 * // => { short: 'A simple weather API', extended: '', full: 'A simple weather API' }
 *
 * // Description with separator - splits into short and extended
 * parseDescription('Weather API for forecasts\n---\nThis API supports multiple...')
 * // => {
 * //   short: 'Weather API for forecasts',
 * //   extended: 'This API supports multiple...',
 * //   full: 'Weather API for forecasts\n---\nThis API supports multiple...'
 * // }
 * ```
 */

// @note the separator must be on its own line with optional whitespace
const DESCRIPTION_SEPARATOR = /\n---\n/

export interface ParsedDescription {
  /**
   * The short description (before the separator, or full text if no separator).
   * Used in listings, backstory injection, and anywhere token efficiency matters.
   */
  short: string

  /**
   * The extended description (after the separator, or empty if no separator).
   * Used when the resource is installed/activated to provide additional context.
   */
  extended: string

  /**
   * The full original description unchanged.
   */
  full: string
}

/**
 * Parses a description string that may contain a markdown separator (---).
 *
 * @param description - The description string to parse
 * @returns An object containing short, extended, and full descriptions
 */
export function parseDescription(description: string): ParsedDescription {
  if (!description) {
    return {
      short: '',
      extended: '',
      full: '',
    }
  }

  const parts = description.split(DESCRIPTION_SEPARATOR)

  if (parts.length === 1) {
    // no separator found, use full description as short
    return {
      short: description.trim(),
      extended: '',
      full: description.trim(),
    }
  }

  const short = parts[0].trim()
  const extended = parts.slice(1).join('\n---\n').trim()

  return {
    short,
    extended,
    full: description.trim(),
  }
}

/**
 * Gets only the short description from a description string.
 * Convenience function for when you only need the short part.
 *
 * @param description - The description string to parse
 * @returns The short description
 */
export function getShortDescription(description: string): string {
  return parseDescription(description).short
}

/**
 * Gets only the extended description from a description string.
 * Convenience function for when you only need the extended part.
 *
 * @param description - The description string to parse
 * @returns The extended description (empty string if no separator)
 */
export function getExtendedDescription(description: string): string {
  return parseDescription(description).extended
}

/**
 * Gets the combined description with the --- separator removed.
 * This joins the short and extended parts with a double newline for
 * consistent display without the horizontal rule markers.
 *
 * @param description - The description string to parse
 * @returns The combined description without separator markers
 */
export function getCombinedDescription(description: string): string {
  const { short, extended } = parseDescription(description)

  if (!extended) {
    return short
  }

  return `${short}\n\n${extended}`
}
