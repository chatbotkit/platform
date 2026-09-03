/**
 * Humanizes an action/function identifier into a friendly, readable label.
 *
 * Handles snake_case, kebab-case and camelCase/PascalCase identifiers and
 * renders them in sentence case, so e.g. `some_function` and `someFunction`
 * both become "Some function".
 */
export function humanizeActionName(name: string): string {
  if (typeof name !== 'string') {
    return ''
  }

  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase boundaries
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // split acronym boundaries
    .replace(/[_-]+/g, ' ') // snake_case / kebab-case to spaces
    .replace(/\s+/g, ' ') // collapse repeated whitespace
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase()) // capitalize first letter only
}
