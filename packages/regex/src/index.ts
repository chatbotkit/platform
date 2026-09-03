export const WHITE_SPACE_REGEX = /[\s\n\r]+/

export const SINGLE_QUOTE_REGEX = /['\u2018\u2019\u201f\u201e]/
export const UNICODE_SINGLE_QUOTE_REGEX = /[\u2018\u2019\u201f\u201e]/

export const DOUBLE_QUOTE_REGEX = /["\u201C\u201D]/
export const UNICODE_DOUBLE_QUOTE_REGEX = /[\u201C\u201D]/

/**
 * Escapes special regex characters in a string
 */
export function escape(input: string): string {
  // @note function borrowed from https://github.com/IonicaBizau/regex-escape.js/blob/master/lib/index.js

  return input.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
}

/**
 * Converts a string or RegExp to a RegExp instance
 */
export function regex(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input
  }

  const match = input.match(/^\/(.*)\/([a-z]*)$/i)

  if (match) {
    return new RegExp(match[1], match[2])
  }

  return new RegExp(escape(input))
}

/**
 * Checks if a string is in regex format (e.g., "/pattern/flags")
 */
export function isRegexString(input: string): boolean {
  return /^\/(.*)\/([a-z]*)$/i.test(input)
}
