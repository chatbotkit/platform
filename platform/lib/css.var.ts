/**
 * Recursively creates var declarations for CSS custom properties.
 */
export function accessVar(...args: string[]): string {
  const argsCopy = args.slice()

  const name = argsCopy.shift()

  if (name) {
    if (argsCopy.length === 0) {
      if (name.startsWith('--')) {
        return `var(${name})`
      } else {
        return name
      }
    } else {
      return `var(${name}, ${accessVar(...argsCopy)})`
    }
  } else {
    return ''
  }
}
