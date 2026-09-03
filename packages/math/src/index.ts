import { assert } from '@chatbotkit-dev/debug'

/**
 * Rounds a number to the nearest multiple of another number.
 */
export function roundToNearest(num: number, n: number): number {
  return Math.round(num / n) * n
}

/**
 * Clamps a number between a minimum and maximum value.
 */
export function clamp(num: number, min: number, max: number): number {
  assert(typeof num === 'number', 'num must be a number')
  assert(typeof min === 'number', 'min must be a number')
  assert(typeof max === 'number', 'max must be a number')
  assert(min <= max, 'min must be less than or equal to max')

  return Math.min(Math.max(num, min), max)
}
