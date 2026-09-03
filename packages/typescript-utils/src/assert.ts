/**
 * Utility type that ensures a specific key does NOT exist in a type.
 * If the key exists, it causes a compile-time error.
 *
 * @example
 * ```typescript
 * type MyType = { foo: string; bar: number }
 *
 * // This will compile (baz doesn't exist)
 * type Check1 = AssertKeyNotExists<MyType, 'baz'> // true
 *
 * // This will fail to compile (foo exists)
 * type Check2 = AssertKeyNotExists<MyType, 'foo'> // never
 * ```
 *
 * @template T - The type to check
 * @template K - The key that should not exist
 * @returns true if key doesn't exist, never if it does
 */
export type AssertKeyNotExists<
  T,
  K extends PropertyKey
> = K extends keyof NonNullable<T> ? never : true

/**
 * Runtime helper to assert at compile-time that a key doesn't exist in a type.
 * Used with const assertion to trigger type checking.
 *
 * @example
 * ```typescript
 * type MyType = { foo: string; bar: number }
 *
 * // This will compile
 * const check: AssertKeyNotExists<MyType, 'baz'> = true
 *
 * // This will fail to compile
 * const check: AssertKeyNotExists<MyType, 'foo'> = true
 * ```
 *
 * @param _assertion - The type assertion result (always true at runtime if it compiles)
 * @returns true
 */
export function assertKeyNotExists(_assertion: true): true {
  return true
}
