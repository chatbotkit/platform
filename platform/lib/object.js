// @ts-check
import deepMerge from 'deepmerge'
import { deepEqual } from 'fast-equals'
import deepClone from 'rfdc/default'

export const OMIT_UNDEFINED = (_k, v) => v === undefined
export const OMIT_NULL = (_k, v) => v === null

/**
 * @param {unknown} obj
 * @param {string} key
 * @returns {boolean}
 */
export function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/**
 * @param {object} obj
 * @returns {boolean}
 */
export function isEmpty(obj) {
  return Object.keys(obj).length === 0
}

/**
 * @param {object} obj
 * @param {string} key
 * @returns {any}
 */
export function get(obj, key) {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }

  if (Array.isArray(obj)) {
    return obj[key]
  }

  if (has(obj, key)) {
    return obj[key]
  }

  return undefined
}

/**
 * @param {object} obj
 * @param {string} key
 * @returns {any}
 */
export function getCaseInsensitive(obj, key) {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }

  if (Array.isArray(obj)) {
    return obj[key]
  }

  const lowerKey = key.toLowerCase()

  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === lowerKey) {
      return v
    }
  }

  return undefined
}

/**
 * @param {object} objA
 * @param {object} objB
 * @returns {boolean}
 */
export function equal(objA, objB) {
  return deepEqual(objA, objB)
}

/**
 * @param {any} obj
 * @returns {any}
 * @todo use better method to make object primitive
 */
export function primitive(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * @param {any} obj
 * @returns {any}
 */
export function clone(obj) {
  return deepClone(obj)
}

/**
 * @param {...any} args
 * @returns {Record<string, any>}
 */
export function merge(...args) {
  return deepMerge.all(args)
}

/**
 * Deep merges multiple objects together with configurable options.
 *
 * @param {object[]} objects - Array of objects to merge
 * @param {import('deepmerge').Options} [options] - Merge options
 * @returns {Record<string, any>}
 */
export function mergeAll(objects, options) {
  return deepMerge.all(objects, options)
}

/**
 * @param {any} obj
 * @return {any}
 */
export function freeze(obj) {
  return Object.freeze(clone(obj))
}

/**
 * Converts a nested object to a flat dictionary of key-value pairs.
 *
 * @param {object} obj
 * @param {string} [prefix]
 * @param {string} [separator]
 * @returns {object}
 */
export function flatten(obj, prefix = '', separator = '.') {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, prefix + key + separator, separator))
    } else {
      result[prefix + key] = value
    }
  }

  return result
}

/**
 * Converts dictionary of key-value pairs to a nested object.
 *
 * @param {object} obj
 * @param {string} [separator]
 * @returns {object}
 * @todo support arrays
 */
export function unflatten(obj, separator = '.') {
  const result = {}

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split(separator)

    let current = result

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }

      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
  }

  return result
}

/**
 * Converts an object without some keys to a new object.
 *
 * @param {unknown} obj
 * @param {(string|RegExp|Function)[]} keys
 * @param {number} [recursion=0]
 * @returns {any}
 */
export function omit(obj, keys, recursion = 0) {
  if (keys.length === 0) {
    return obj
  }

  if (recursion < 0) {
    return obj
  }

  const testers = {
    ...Object.fromEntries(
      keys.map((key) => {
        if (key instanceof RegExp) {
          return [key, (k) => key.test(k)]
        } else if (typeof key === 'function') {
          return [key, (k, v) => key(k, v)]
        } else {
          return [key, (k) => k === key]
        }
      })
    ),
  }

  switch (true) {
    case Array.isArray(obj): {
      return obj.map((item) => omit(item, keys, recursion - 1))
    }

    case typeof obj === 'object' && obj !== null: {
      return Object.fromEntries(
        Object.entries(obj)
          .map(([key, value]) => {
            value = omit(value, keys, recursion - 1)

            return Object.values(testers).some((test) => test(key, value))
              ? []
              : [key, value]
          })
          .filter((arr) => arr.length > 0)
      )
    }

    default: {
      return obj
    }
  }
}

/**
 * Converts an object with some keys to a new object.
 *
 * @param {unknown} obj
 * @param {(string|RegExp|Function)[]} keys
 * @param {number} [recursion=0]
 * @returns {any}
 */
export function pick(obj, keys, recursion = 0) {
  if (keys.length === 0) {
    return obj
  }

  if (recursion < 0) {
    return obj
  }

  const testers = {
    ...Object.fromEntries(
      keys.map((key) => {
        if (key instanceof RegExp) {
          return [key, (k) => key.test(k)]
        } else if (typeof key === 'function') {
          return [key, (k, v) => key(k, v)]
        } else {
          return [key, (k) => k === key]
        }
      })
    ),
  }

  switch (true) {
    case Array.isArray(obj): {
      return obj.map((item) => pick(item, keys, recursion - 1))
    }

    case typeof obj === 'object' && obj !== null: {
      return Object.fromEntries(
        Object.entries(obj)
          .map(([key, value]) => {
            value = pick(value, keys, recursion - 1)

            return Object.values(testers).some((test) => test(key, value))
              ? [key, value]
              : []
          })
          .filter((arr) => arr.length > 0)
      )
    }

    default: {
      return obj
    }
  }
}

/**
 * @param {unknown} obj
 * @param {(string|RegExp|Function)} oldKey
 * @param {string|Function} newKey
 * @param {number} [recursion=Infinity]
 * @returns {unknown}
 */
export function rename(obj, oldKey, newKey, recursion = Infinity) {
  if (recursion < 0) {
    return obj
  }

  const tester = (key, value) => {
    if (oldKey instanceof RegExp) {
      return oldKey.test(key)
    } else if (typeof oldKey === 'function') {
      return oldKey(key, value)
    } else {
      return key === oldKey
    }
  }

  switch (true) {
    case Array.isArray(obj): {
      return obj.map((item) => rename(item, oldKey, newKey, recursion - 1))
    }

    case typeof obj === 'object' && obj !== null: {
      return Object.keys(obj).reduce((acc, key) => {
        const newValue = rename(obj[key], oldKey, newKey, recursion - 1)

        acc[
          tester(key, obj[key])
            ? typeof newKey === 'function'
              ? newKey(key)
              : newKey
            : key
        ] = newValue

        return acc
      }, {})
    }

    default: {
      return obj
    }
  }
}

/**
 * @param {unknown} obj
 * @param {unknown} oldValue
 * @param {unknown} newValue
 * @param {number} [recursion=Infinity]
 * @returns {unknown}
 */
export function revalue(obj, oldValue, newValue, recursion = Infinity) {
  const tester = (value) => {
    return value === oldValue
  }

  if (recursion < 0) {
    return obj
  }

  switch (true) {
    case Array.isArray(obj): {
      return obj.map((item) => revalue(item, oldValue, newValue, recursion - 1))
    }

    case typeof obj === 'object' && obj !== null: {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
          return [key, revalue(value, oldValue, newValue, recursion - 1)]
        })
      )
    }

    default: {
      return tester(obj) ? newValue : obj
    }
  }
}

/**
 * @param {unknown} obj
 * @param {string|((key: string) => boolean)} key
 * @returns {unknown[]}
 */
export function find(obj, key) {
  const tester = typeof key === 'function' ? key : (k) => k === key

  const result = []

  if (typeof obj !== 'object' || obj === null) {
    return result
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      result.push(...find(item, key))
    }
  } else {
    for (const [k, v] of Object.entries(obj)) {
      if (tester(k)) {
        result.push(v)
      }

      result.push(...find(v, key))
    }
  }

  return result
}

/**
 * @param {unknown} obj
 * @param {(value: unknown, key: string, obj: object) => boolean} tester
 * @param {(value: unknown, key: string, obj: object) => unknown} replacer
 * @returns {unknown}
 */
export function replace(obj, tester, replacer) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (tester(item, String(index), obj)) {
        return replacer(item, String(index), obj)
      }

      return replace(item, tester, replacer)
    })
  } else {
    const result = {}

    for (const [key, value] of Object.entries(obj)) {
      if (tester(value, key, obj)) {
        result[key] = replacer(value, key, obj)
      } else {
        result[key] = replace(value, tester, replacer)
      }
    }

    return result
  }
}

/**
 * General-purpose replacer function for custom transformations.
 * Processes objects to find transformation markers and applies the corresponding
 * transformation functions.
 *
 * @param {unknown} obj - The object to process
 * @param {Object.<string, function>} transformations - An object mapping transformation keys to transformation functions
 * @returns {unknown} - The processed object with transformations applied
 * @todo rename the function to be more clear or move it into its own module
 */
export function resolveMarkers(obj, transformations) {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveMarkers(item, transformations))
  }

  if (typeof obj === 'object') {
    const result = {}

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        let transformed = false

        for (const [transformationKey, transformationFunc] of Object.entries(
          transformations
        )) {
          if (transformationKey in value) {
            result[key] = transformationFunc(
              value[transformationKey],
              value,
              obj
            )

            transformed = true

            break
          }
        }

        if (!transformed) {
          result[key] = resolveMarkers(value, transformations)
        }
      } else {
        result[key] = resolveMarkers(value, transformations)
      }
    }

    return result
  }

  return obj
}

/**
 * @param {object} obj
 * @param {(entry: [string, any]) => [string, any]} fn
 * @returns {object}
 */
export function map(obj, fn) {
  return Object.fromEntries(Object.entries(obj).map(fn))
}

/**
 * Like `omit(obj, [OMIT_NULL])`, but an explicit `null` on the listed keys is
 * preserved so a caller can clear a nullable column - dropping the null would
 * silently turn "clear this" into a no-op.
 *
 * @template {object} T
 * @param {T} obj
 * @param {string[]} nullableKeys
 * @returns {{ [K in keyof T]?: Exclude<T[K], null> }} the REST routes accept
 *   null for the listed keys, but the request types do not model it, so the
 *   result is typed like a plain `omit(obj, [OMIT_NULL])`
 */
export function omitNullExcept(obj, nullableKeys) {
  return /** @type {{ [K in keyof T]?: Exclude<T[K], null> }} */ (
    omit(obj, [
      (/** @type {string} */ key, /** @type {unknown} */ value) =>
        value === null && !nullableKeys.includes(key),
    ])
  )
}
