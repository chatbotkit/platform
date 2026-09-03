/**
 * Helper type that checks if two types are exactly equal.
 */
export type Exact<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? T
    : never
  : never

/**
 * Helper type that checks if two object types have exactly the same keys.
 * This is stricter than Exact for object types because it ensures both types
 * have the same set of keys, regardless of whether they are optional.
 */
export type ExactKeys<T, U> = keyof T extends keyof U
  ? keyof U extends keyof T
    ? T
    : never
  : never
