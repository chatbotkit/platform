/* eslint-disable @typescript-eslint/no-unsafe-function-type */

type ImmutableObject<T> = {
  readonly [K in keyof T]: Immutable<T[K]>
}

export type Immutable<T> = {
  readonly [K in keyof T]: T[K] extends Function ? T[K] : ImmutableObject<T[K]>
}

export type OptionalExceptFor<T, TRequired extends keyof T> = Partial<T> &
  Pick<T, TRequired>
