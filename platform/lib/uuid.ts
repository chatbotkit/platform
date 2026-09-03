// @note uuid v4 format validation regex - case insensitive
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates if a string is a valid UUID v4 format.
 *
 * @param value - The string to validate
 * @returns true if the value is a valid UUID format, false otherwise
 */
export function isUuid(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return UUID_REGEX.test(value)
}
