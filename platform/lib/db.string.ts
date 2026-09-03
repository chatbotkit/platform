import {
  MAX_DB_MEDIUMTEXT_BYTES_LENGTH,
  MAX_DB_STRING_BYTES_LENGTH,
  MAX_DB_TEXT_BYTES_LENGTH,
} from '@/prisma/constraints'

import { trimToByteLength } from '@/lib/string'

/**
 * Converts a string to a database-safe string by trimming to byte length
 */
export function stringToDbString(
  value: string,
  maxLength: number = MAX_DB_STRING_BYTES_LENGTH
): string {
  // @note this is not ideal but it does not work otherwise
  // @todo we might need to set the max value of the db to lower than 255

  return trimToByteLength(value, maxLength)
}

/**
 * Checks if a string fits within database string length limit
 */
export function isDbString(value: string): boolean {
  return value.length <= MAX_DB_STRING_BYTES_LENGTH
}

/**
 * Checks if a string fits within database text length limit
 */
export function isDbText(value: string): boolean {
  return value.length <= MAX_DB_TEXT_BYTES_LENGTH
}

/**
 * Checks if a string fits within database medium text length limit
 */
export function isDbMediumText(value: string): boolean {
  return value.length <= MAX_DB_MEDIUMTEXT_BYTES_LENGTH
}
