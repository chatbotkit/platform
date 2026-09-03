/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Represents a tuple of any arguments. Useful as a generic constraint for
 * function argument types without triggering eslint any[] warnings.
 *
 * @example
 * function wrap<TArgs extends AnyArgs>(fn: (...args: TArgs) => void): (...args: TArgs) => void {
 *   return (...args) => fn(...args)
 * }
 */
export type AnyArgs<T = any> = T[]
