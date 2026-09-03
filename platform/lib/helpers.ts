/**
 * @todo remove when ? is supported or next compiles better client-side code
 */
export function either<T>(v1: T | undefined, v2: T): T {
  return typeof v1 !== 'undefined' ? v1 : v2
}
