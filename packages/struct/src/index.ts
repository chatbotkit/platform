/**
 * Wraps data to signal that it is already JSON-safe and should bypass
 * makeJsonSafe processing.
 */
export class SafeJson<T = unknown> {
  data: T

  constructor(data: T) {
    this.data = data
  }

  toJSON(): T {
    return this.data
  }
}

interface MakeJsonSafeOptions {
  unsafeKeys?: RegExp
}

/**
 * Represents a JSON-safe version of a type, converting special types to their
 * JSON-compatible equivalents.
 */
type JsonSafe<T> = T extends undefined
  ? null
  : T extends Date
    ? number
    : T extends bigint
      ? number | string
      : T extends Set<infer U>
        ? JsonSafe<U>[]
        : T extends Map<infer K, infer V>
          ? Record<string & JsonSafe<K>, JsonSafe<V>>
          : T extends URL
            ? string
            : T extends (infer U)[]
              ? JsonSafe<U>[]
              : T extends object
                ? { [K in keyof T]: JsonSafe<T[K]> }
                : // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                  T extends Function
                  ? null
                  : T

/**
 * Converts an object to a JSON-safe format by handling special values and types
 */
export function makeJsonSafe<T>(
  object: T,
  options?: MakeJsonSafeOptions
): JsonSafe<T>
export function makeJsonSafe(
  object: unknown,
  options?: MakeJsonSafeOptions
): unknown {
  if (object instanceof SafeJson) {
    return object.data
  }

  // @todo for extra safety we should clone the object before modifying it to
  // avoid circular references - this cloning needs to happen at the start of
  // the function and not recursively

  const { unsafeKeys = /^#/ } = options || {}

  switch (true) {
    case object === undefined: {
      return null
    }

    case object === null: {
      return object
    }

    case object === Infinity: {
      return '$Infinity'
    }

    case object === -Infinity: {
      return '-$Infinity'
    }

    case Number.isNaN(object): {
      return '$NaN'
    }

    case typeof object === 'bigint': {
      if (
        object > BigInt(Number.MAX_SAFE_INTEGER) ||
        object < BigInt(Number.MIN_SAFE_INTEGER)
      ) {
        return object.toString() + 'n'
      } else {
        return Number(object)
      }
    }

    case object instanceof Date: {
      return object.getTime()
    }

    case object instanceof Set: {
      return Array.from(object).map((value) => makeJsonSafe(value, options))
    }

    case object instanceof Map: {
      return Object.fromEntries(
        Array.from(object.entries()).map(([key, value]) => {
          return [makeJsonSafe(key, options), makeJsonSafe(value, options)]
        })
      )
    }

    case object instanceof URL: {
      return object.toString()
    }

    case typeof object === 'object' &&
      object !== null &&
      Object.getPrototypeOf(object)?.toStringTag === '[object Decimal]': {
      return (object as { toNumber: () => number }).toNumber()
    }

    case Array.isArray(object): {
      return object.map((value) => makeJsonSafe(value, options))
    }

    case typeof object === 'object' && object !== null: {
      return Object.fromEntries(
        Object.entries(object)
          // @todo if the object === undefined is removed then we can also
          // safely remove the filter below as well

          .filter(([key]) => {
            return !unsafeKeys || !key.match(unsafeKeys)
          })
          .filter(([, value]) => {
            return value !== undefined
          })
          .map(([key, value]) => {
            return [key, makeJsonSafe(value, options)]
          })
      )
    }

    case typeof object === 'function': {
      return null
    }

    default: {
      return object
    }
  }
}

/**
 * Recursively removes empty string values from an object or array
 */
export function stripEmpty(object: unknown): unknown {
  switch (true) {
    case object === '': {
      return undefined
    }

    case Array.isArray(object): {
      return object.map(stripEmpty).filter((v) => v !== undefined)
    }

    case typeof object === 'object' && object !== null: {
      return Object.fromEntries(
        Object.entries(object).map(([key, value]) => {
          return [key, stripEmpty(value)]
        })
      )
    }

    default: {
      return object
    }
  }
}
