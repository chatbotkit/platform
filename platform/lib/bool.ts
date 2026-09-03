/**
 * Returns the first boolean-like value from the arguments, or false if none are defined
 */
export function firstBoolLike(
  ...booleans: Array<boolean | string | undefined>
): boolean {
  for (const boolean of booleans) {
    if (typeof boolean !== 'undefined') {
      return typeof boolean === 'string' ? boolean === 'true' : boolean
    }
  }

  return false
}

/**
 * Returns true if all arguments are truthy
 */
export function and(...booleans: unknown[]): boolean {
  return booleans.every((boolean) => boolean)
}

/**
 * Returns true if any argument is truthy
 */
export function or(...booleans: unknown[]): boolean {
  return booleans.some((boolean) => boolean)
}
