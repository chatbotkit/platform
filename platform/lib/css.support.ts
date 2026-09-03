export function supports(property: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // @note explicit function check handles both null and undefined cases

  if (typeof window.CSS?.supports !== 'function') {
    return false
  }

  return window.CSS.supports(property, value) || false
}
