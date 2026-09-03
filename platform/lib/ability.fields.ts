/**
 * These fields have special meaning and are used for internal purposes only.
 */
export const SPECIAL_FIELD_PREFIXES = [
  // time
  'EARTH_',
  // resource linking
  'SECRET_',
  'FILE_',
  'BOT_',
  'SPACE_',
  'TASK_',
  // user context
  'USER_',
  'CONVERSATION_',
  'CONTACT_',
  'NAMESPACE_',
  // external
  'EXTERNAL_',
] as const

/**
 * Regular expression for special field prefixes.
 */
export const SPECIAL_FIELD_PREFIXES_REGEXP = new RegExp(
  SPECIAL_FIELD_PREFIXES.join('|'),
  'i'
)

/**
 * Check if the field name is special.
 */
export function isSpecialField(name: string): boolean {
  return SPECIAL_FIELD_PREFIXES_REGEXP.test(name)
}
