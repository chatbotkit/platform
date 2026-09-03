import { toTitleCase } from '@/lib/string'

function tryParseJson(text: string): object | null {
  try {
    const parsed = JSON.parse(text)
    // @note only return if it's actually an object (not a primitive or array)

    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

function stripHtmlMarkup(text: string): string {
  // @note remove HTML/XML tags and normalize whitespace intelligently

  return text
    .replace(/<[^>]*>/g, ' ') // replace HTML/XML tags with space to preserve word boundaries
    .replace(/\s+/g, ' ') // normalize whitespace (multiple spaces, newlines, tabs to single space)
    .replace(/\s+([.,!?;:])/g, '$1') // remove spaces before punctuation
    .trim() // remove leading/trailing whitespace
}

function stringifyValue(
  value: unknown,
  options?: { capitalize?: boolean }
): string {
  // @note primitives (including null/undefined) stringify as-is

  if (value === null || typeof value !== 'object') {
    return String(value)
  }

  // @note arrays render as compact json rather than yaml-like key/value pairs

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  // @note recurse into nested objects so values never render as "[object Object]"

  const extracted = extractInput(value, options)

  return extracted || JSON.stringify(value)
}

export function extractInput(
  input: string | object,
  options?: { capitalize?: boolean }
): string {
  if (input == null) {
    return ''
  }

  if (typeof input === 'string') {
    // @note attempt to parse JSON string first, if successful treat as object

    const parsedJson = tryParseJson(input)

    if (parsedJson) {
      return extractInput(parsedJson, options) // Recursively process the parsed object
    }

    let output = stripHtmlMarkup(input)

    if (options?.capitalize) {
      output = toTitleCase(output)
    }

    return output
  }

  if (typeof input === 'object') {
    if (Object.keys(input).length === 0) {
      return ''
    }

    // @note precedence order: text > input > query > search > action > reason > url
    // @note string properties are extracted directly with HTML/XML markup removed
    // @note object properties are recursed into so nested arguments such as
    //       { input: { query: '...' } } still resolve to a meaningful string
    //       instead of falling through to the yaml fallback as "[object Object]"

    const priorityKeys = [
      'text',
      'input',
      'query',
      'search',
      'action',
      'reason',
      'url',
    ]

    for (const key of priorityKeys) {
      if (!(key in input)) {
        continue
      }

      const value = (input as Record<string, unknown>)[key]

      if (typeof value === 'string') {
        return stripHtmlMarkup(value)
      }

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const extracted = extractInput(value, options)

        if (extracted) {
          return extracted
        }
      }
    }

    // @note convert to a yaml-like format without newlines and extra spaces,
    //       recursing into nested objects/arrays so values never render as
    //       "[object Object]"

    const pairs = Object.entries(input).map(
      ([key, value]) => `${key}: ${stringifyValue(value, options)}`
    )

    return pairs.join(' ')
  }

  return ''
}
