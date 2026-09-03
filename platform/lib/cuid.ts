import { createId, init } from '@paralleldrive/cuid2'

export const DEFAULT_CUID_LENGTH = 24

const CUID2_REGEX = /^[a-z][a-z0-9]{23}$/
const LEGACY_CUID_REGEX = /^c[a-z0-9]{24}$/

/**
 * Creates a full-length CUID2 identifier.
 */
export function cuid(): string {
  return createId()
}

/**
 * Validates if a string looks like a platform CUID.
 *
 * Accepts both the current default 24-character CUID2 shape and the older
 * 25-character legacy CUIDs that still exist in persisted resources.
 *
 * @param value - The string to validate
 * @returns true if the value matches a supported CUID format, false otherwise
 */
export function isCuid(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return CUID2_REGEX.test(value) || LEGACY_CUID_REGEX.test(value)
}

/**
 * Creates a deterministic-ish ID generator for a namespace.
 *
 * @param namespace namespace fingerprint used by cuid2
 * @param length output id length, defaults to full-length cuid2 ids
 */
export function generate(
  namespace: string | null | undefined,
  length = DEFAULT_CUID_LENGTH
): () => string {
  return init({
    random: Math.random,
    length: length,
    fingerprint: namespace === null ? undefined : namespace,
  })
}

export default cuid
