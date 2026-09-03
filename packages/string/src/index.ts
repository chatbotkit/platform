// @ts-check
import {
  UNICODE_DOUBLE_QUOTE_REGEX,
  UNICODE_SINGLE_QUOTE_REGEX,
  escape,
} from '@chatbotkit-dev/regex'

export function getRandomId(prefix?: string, joiner = ''): string {
  return `${prefix || ''}${prefix ? joiner : ''}${Math.random()
    .toString(32)
    .slice(2)}`
}

export function getTempId() {
  return getRandomId('tmp-')
}

export function replace(
  input: string,
  search: string | RegExp,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacement: any
): string {
  if (search instanceof RegExp) {
    search = new RegExp(search.source, search.flags)
  }

  return input.replace(search, replacement)
}

export async function replaceAsync(
  input: string,
  search: string | RegExp,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacement: any
): Promise<string> {
  if (search instanceof RegExp) {
    search = new RegExp(search.source, search.flags.replace(/g|$/, 'g'))
  } else {
    search = new RegExp(escape(search), 'g')
  }

  const searches = Array.from(input.matchAll(search)).slice(0, 1)

  const replacements = await Promise.all(
    searches.map(async (match) => {
      return typeof replacement === 'function'
        ? await replacement(match)
        : replacement
    })
  )

  let i = 0

  return input.replace(search, () => replacements[i++])
}

export function replaceAll(
  input: string,
  search: string | RegExp,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacement: any
): string {
  if (search instanceof RegExp) {
    search = new RegExp(search.source, search.flags.replace(/g|$/, 'g'))
  }

  return input.replaceAll(search, replacement)
}

export async function replaceAllAsync(
  input: string,
  search: string | RegExp,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacement: any
): Promise<string> {
  if (search instanceof RegExp) {
    search = new RegExp(search.source, search.flags.replace(/g|$/, 'g'))
  } else {
    search = new RegExp(escape(search), 'g')
  }

  const searches = Array.from(input.matchAll(search))

  const replacements = await Promise.all(
    searches.map(async (match) => {
      return typeof replacement === 'function'
        ? await replacement(match)
        : replacement
    })
  )

  let i = 0

  return input.replace(search, () => replacements[i++])
}

export function replaceWithMap(
  input: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: Record<string, any>
): string {
  for (const [name, value] of Object.entries(map)) {
    input = replaceAll(
      input,
      name,
      typeof value === 'function' ? value.bind(null, input, map) : value
    )
  }

  return input
}

export async function replaceWithMapAsync(
  input: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: Record<string, any>
): Promise<string> {
  for (const [name, value] of Object.entries(map)) {
    input = await replaceAllAsync(
      input,
      name,
      typeof value === 'function' ? value.bind(null, input, map) : value
    )
  }

  return input
}

export function joinTrimmedNotEmpty(
  items: (string | null | undefined)[],
  join = '\n\n'
): string {
  return items
    .flat()
    .filter((i): i is string => !!i)
    .map((i) => i.toString().trim())
    .filter((i) => !!i)
    .join(join)
}

export function joinWithJoiner(items: string[], join = 'and'): string {
  items = items.flat()

  if (!items || items.length === 0) {
    return ''
  } else if (items.length === 1) {
    return items[0]
  } else if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  } else {
    const allButLast = items.slice(0, items.length - 1)

    return `${allButLast.join(', ')}, ${join} ${items[items.length - 1]}`
  }
}

export function joinWithAnd(items: string[], join = 'and'): string {
  return joinWithJoiner(items, join)
}

export function joinWithOr(items: string[], join = 'or'): string {
  return joinWithJoiner(items, join)
}

export function filterNonEmpty(items: (string | null | undefined)[]): string[] {
  return items.map((i) => i?.trim()).filter((i): i is string => !!i)
}

export function* getPositionsIt(input, search) {
  let fromIndex = 0

  for (;;) {
    const index = input.indexOf(search, fromIndex)

    if (index >= 0) {
      fromIndex = index + search.length

      yield [index, fromIndex]
    } else {
      break
    }
  }
}

export function getPositions(input: string, search: string): number[][] {
  return Array.from(getPositionsIt(input, search))
}

export function replaceBetween(
  input: string,
  begin: number,
  end: number,
  replacement: string
): string {
  return input.substring(0, begin) + replacement + input.substring(end)
}

/**
 * @todo convert only non-ascii characters
 *
 */
export function toUnicodeEscapedString(input: string): string {
  let result = ''

  for (let i = 0; i < input.length; i++) {
    result +=
      '\\u' + ('000' + input[i].charCodeAt(0).toString(16)).substring(-4)
  }

  return result
}

export interface ReplacementCoordinates {
  begin: number
  end: number
  input: string
  output: string
}

/**
 * Replace all occurrences of search with replacement in input string and return
 * the result as an array of replacement objects and the final result.
 */
export function replaceWithCoordinates(
  input: string,
  replacements: Iterable<[string, string]>
): [...ReplacementCoordinates[], string] {
  const output: (ReplacementCoordinates | string)[] = []

  let currentIndex = 0

  while (currentIndex < input.length) {
    let found = false

    for (const [search, replacement] of replacements) {
      if (input.startsWith(search, currentIndex)) {
        const origInput = input

        const resultOutput = replaceBetween(
          input,
          currentIndex,
          currentIndex + search.length,
          replacement
        )

        output.push({
          begin: currentIndex,
          end: currentIndex + replacement.length,
          input: origInput,
          output: resultOutput,
        })

        input = resultOutput

        currentIndex += replacement.length

        found = true

        break
      }
    }

    if (!found) {
      currentIndex += 1
    }
  }

  output.push(input)

  // @ts-ignore
  return output
}

/**
 * @param {...any} strings
 * @returns {string|undefined}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anyString(...strings: any[]): string | undefined {
  for (const string of strings) {
    if (typeof string === 'string') {
      return string
    }
  }
}

/**
 * @param {...any} strings
 * @returns {string|undefined}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anyNonEmptyString(...strings: any[]): string | undefined {
  for (const string of strings) {
    if (typeof string === 'string' && string) {
      return string
    }
  }
}

export function removeSpaces(input: string): string {
  return input.replace(/\s+/g, ' ')
}

export function removeEmojis(input: string): string {
  return input.replace(
    /(?![*#0-9]+)[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu,
    ''
  )
}

export function removeSymbols(input: string): string {
  // @note match only other symbols but not math and currency

  return input.replace(/\p{So}/gu, '').replace(/\p{Sk}/gu, '')
}

export function normalizeQuotes(input: string): string {
  return input
    .replace(new RegExp(UNICODE_SINGLE_QUOTE_REGEX, 'g'), "'")
    .replace(new RegExp(UNICODE_DOUBLE_QUOTE_REGEX, 'g'), '"')
}

export function normalizeSpaces(input: string): string {
  // @note see https://www.regular-expressions.info/unicode.html

  return input
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\p{Zs}/gu, ' ') // whitespace characters
    .trim()
}

export function normalizeParagraphs(input: string): string {
  // @note see https://www.regular-expressions.info/unicode.html

  return input
    .replace(/\n\r/g, '\n')
    .replace(/\p{Zl}/gu, '\n') // line separators
    .replace(/\p{Zp}/gu, '\n') // paragraph separators
    .replace(/\n\n+/g, '\n\n')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
}

export function normalizeNonprintable(input: string): string {
  return input
    .split('\n')
    .map((l) => l.replace(/\p{C}/gu, ''))
    .join('\n')
}

/**
 * Removes replacement characters (�) and other problematic Unicode characters
 * from a string
 *
 */
export function normalizeReplacements(input: string): string {
  if (!input) {
    return input
  }

  return (
    input
      // remove replacement character (U+FFFD)
      .replace(/\uFFFD/gu, '')
      // remove broken UTF-8 sequences that might appear as replacement chars
      .replace(/[\uD800-\uDFFF]/g, '')
  )
}

/**
 * The function replaces all escaped unicode characters with their unescaped
 * counterparts.
 *
 */
export function normalizeUnicodeEscapes(input: string): string {
  return input.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
    return String.fromCharCode(parseInt(grp, 16))
  })
}

export function normalizeText(input: string): string {
  return normalizeParagraphs(
    normalizeSpaces(
      normalizeQuotes(normalizeReplacements(normalizeNonprintable(input)))
    )
  )
}

export function splitTrim(input: string, sep: string): string[] {
  return input
    .split(sep)
    .map((i) => i.trim())
    .filter((i) => i)
}

export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\W/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/g, '')
    .replace(/-$/g, '')
}

export function toPascalCase(input: string): string {
  const result = input
    .replace(/\b\w+\b/g, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1)
    })
    .replace(/\s+|\W+|-/g, '')

  return result
}

export function toCamelCase(input: string): string {
  let result = input
    .replace(/\b\w+\b/g, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1)
    })
    .replace(/\s+|\W+|-/g, '')

  result = result.charAt(0).toLowerCase() + result.slice(1)

  return result
}

export function toSnakeCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\W/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/g, '')
    .replace(/_$/g, '')
}

export function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\W/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/g, '')
    .replace(/-$/g, '')
}

export function toTitleCase(input: string): string {
  return input.toLowerCase().replace(/\b\w+\b/g, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1)
  })
}

export function toSentenceCase(input: string): string {
  return input
    .replace(/^\w/, (match) => match.toUpperCase())
    .replace(/\.\s+\w/g, (match) => match.toUpperCase())
}

export function toHeadingCase(input: string): string {
  return input
    .split(/(?=[A-Z])|[_\-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function toWordCase(input: string): string {
  return input
    .split(/(?=[A-Z])|[_\-\s]+/)
    .map((word) => word.toLowerCase())
    .join(' ')
}

/**
 * @param {string} input
 * @returns {string}
 */
export function trimToFirstOccurrence(input: string, search: string): string {
  const index = input.indexOf(search)

  if (index >= 0) {
    input = input.substring(index)
  }

  return input
}

/**
 * @param {string} input
 * @returns {string}
 */
export function trimToLastOccurrence(input: string, search: string): string {
  const index = input.lastIndexOf(search)

  if (index >= 0) {
    input = input.substring(0, index + search.length)
  } else {
  }

  return input
}

/**
 * Splits a string inclusively.
 */
export function inclusiveSplit(
  input: string,
  search: string | RegExp
): string[] {
  const matches = Array.from(
    input.matchAll(
      typeof search === 'string'
        ? new RegExp(escape(search), 'g')
        : new RegExp(search.source, search.flags.replace(/g|$/, 'g'))
    )
  )

  const result: string[] = []

  let lastIndex = 0

  for (const match of matches) {
    const index = match.index ?? 0

    if (lastIndex < index) {
      result.push(input.slice(lastIndex, index))
    }

    result.push(match[0])

    lastIndex = index + match[0].length
  }

  if (lastIndex < input.length) {
    result.push(input.slice(lastIndex))
  }

  return result
}

/**
 * This function recursively splits a string into parts using the provided
 * terms. In other words each part is split into smaller parts using the terms,
 * which can be either literal strings or regular expressions.
 *
 */
export function recursiveSplit(
  input: string,
  terms: (string | RegExp)[]
): string[] {
  if (terms.length === 0) {
    return [input]
  }

  const [firstTerm, ...remainingTerms] = terms

  const splitParts = input.split(firstTerm)

  return splitParts.flatMap((part) => recursiveSplit(part, remainingTerms))
}

export function inclusiveRecursiveSplit(
  input: string,
  terms: (string | RegExp)[]
): string[] {
  if (terms.length === 0) {
    return [input]
  }

  const [firstTerm, ...remainingTerms] = terms

  const splitParts = inclusiveSplit(input, firstTerm)

  return splitParts.flatMap((part) =>
    inclusiveRecursiveSplit(part, remainingTerms)
  )
}

export function splitOnce(input: string, separator: string): string[] {
  const index = input.indexOf(separator)

  if (index >= 0) {
    return [
      input.substring(0, index),
      input.substring(index + separator.length),
    ]
  }

  return [input]
}

export function byteLength(input: string): number {
  return new TextEncoder().encode(input).length
}

/**
 * @ai
 * @param {string} str
 * @param {number} [start=0]
 * @param {number} [end=Infinity]
 * @returns {string}
 */
export function byteSlice(str: string, start = 0, end = Infinity): string {
  const encoder = new TextEncoder()
  const encodedStr = encoder.encode(str)
  const byteLength = encodedStr.length

  if (start < 0) {
    start = byteLength + start
  }

  if (end < 0) {
    end = byteLength + end
  }

  start = Math.max(0, Math.min(byteLength, start))
  end = Math.max(0, Math.min(byteLength, end))

  if (start >= end) {
    return ''
  }

  const bytes = encodedStr.slice(start, end)
  const decoder = new TextDecoder()

  return decoder.decode(bytes)
}

/**
 * Trims empty lines from the start and end of the input string.
 *
 */
export function trimLines(input: string): string {
  return input.replace(/^\n+|\n+$/g, '')
}

/**
 * Converts a string to a hash number.
 *
 */
export function stringToHash(string: string): number {
  let hash = 0

  if (string.length === 0) {
    return hash
  }

  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i)

    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  return Math.abs(hash)
}

export function countBytes(str: string): number {
  let byteCount = 0

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)

    byteCount +=
      c < 1 << 7
        ? 1
        : c < 1 << 11
        ? 2
        : c < 1 << 16
        ? 3
        : c < 1 << 21
        ? 4
        : c < 1 << 26
        ? 5
        : c < 1 << 31
        ? 6
        : Number.NaN
  }

  return byteCount
}

/**
 * Trims a string to a byte length.
 *
 */
export function trimToByteLength(str: string, len: number): string {
  let byteCount = 0

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)

    byteCount +=
      c < 1 << 7
        ? 1
        : c < 1 << 11
        ? 2
        : c < 1 << 16
        ? 3
        : c < 1 << 21
        ? 4
        : c < 1 << 26
        ? 5
        : c < 1 << 31
        ? 6
        : Number.NaN

    if (byteCount > len) {
      return str.substring(0, i)
    }
  }

  return str
}

/**
 * Trim the text to length and add ellipsis if needed.
 *
 */
export function ellipsis(text: string, length: number): string {
  if (text.length <= length) {
    return text
  }

  return text.substring(0, length - 3) + '...'
}

export function singleQuote(input: string): string {
  return `'${input.replace(/'/g, "\\'")}'`
}

export function doubleQuote(input: string): string {
  return `"${input.replace(/"/g, '\\"')}"`
}
