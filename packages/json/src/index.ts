/* eslint-disable @typescript-eslint/no-explicit-any */
import { trimToFirstOccurrence, trimToLastOccurrence } from '@chatbotkit-dev/string'

/**
 * Parses a JSON string in a relaxed way, returning null if the string is invalid.
 */
export function relaxedJsonParse(input: string): any {
  input = input.trim()

  if (input.startsWith('{')) {
    input = trimToLastOccurrence(input, '}')
  }

  if (input.endsWith('}')) {
    input = trimToFirstOccurrence(input, '{')
  }

  // @todo add more relaxed parsing and normalizations

  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

export function safeJsonParse(input: any): any {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

export function parse(input: string): any {
  return JSON.parse(input)
}

export function tryParse(input: string): any {
  try {
    return parse(input)
  } catch {
    return null
  }
}

export function stringify(input: any): string {
  return JSON.stringify(input, (_key, value) => {
    if (typeof value === 'bigint') {
      if (value > Number.MAX_SAFE_INTEGER) {
        return value.toString() + 'n' // @note append 'n' or use a specific format
      } else {
        return Number(value)
      }
    }

    return value
  })
}

export function tryStringify(input: any): string {
  try {
    return stringify(input)
  } catch {
    return ''
  }
}

export function isParsable(input: string): boolean {
  try {
    parse(input)

    return true
  } catch {
    return false
  }
}

export default {
  parse,
  tryParse,
  stringify,
  tryStringify,
}
