/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyArgs } from './args'

/**
 * Represents any return type. Useful as a generic constraint for function
 * return types without triggering eslint any warnings.
 */
export type AnyReturn = any

/**
 * Represents any function type. Useful as a generic constraint when you need
 * to accept any callable without triggering eslint any[] warnings everywhere.
 *
 * @example
 * function wrap<T extends AnyFunction>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
 *   return (...args) => fn(...args)
 * }
 */
export type AnyFunction<
  TArgs extends AnyArgs = AnyArgs,
  TReturn = AnyReturn
> = (...args: TArgs) => TReturn

/**
 * Represents any async function type.
 *
 * @example
 * function wrapAsync<T extends AnyAsyncFunction>(fn: T): T {
 *   return (async (...args) => await fn(...args)) as T
 * }
 */
export type AnyAsyncFunction<
  TArgs extends AnyArgs = AnyArgs,
  TReturn = AnyReturn
> = (...args: TArgs) => Promise<TReturn>
