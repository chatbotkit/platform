/**
 * Converts an object to a URL query string
 */
export function q(input: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)])
    )
  ).toString()
}
