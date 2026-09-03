import minimatch from 'minimatch'

/**
 * Performs a glob match on the input string. The pattern can be multiline. The
 * negative patterns acts as an exclusion filter. We do this by first matching
 * the input against all the patterns, and then checking if the input matches
 * any of the negative patterns.
 */
export function match(input: string, pattern: string | string[]): boolean {
  const lines = typeof pattern === 'string' ? pattern.split('\n') : pattern
  const trimmedLines = lines.map((l) => l.trim()).filter((l) => l)

  const positivePatterns = trimmedLines.filter((l) => !l.startsWith('!'))
  const negativePatterns = trimmedLines
    .filter((l) => l.startsWith('!'))
    .map((l) => l.substring(1))

  return (
    positivePatterns.some((p) => minimatch(input, p)) &&
    !negativePatterns.some((p) => minimatch(input, p))
  )
}

/**
 * Creates a glob URL by combining a base URL with a pattern and normalizing
 * the braces.
 */
export function makeGlobUrl(url: string, pattern: string): string {
  const u = new URL(pattern, url)

  return u.origin + u.pathname.replace(/%7B/gi, '{').replace(/%7D/gi, '}')
}
