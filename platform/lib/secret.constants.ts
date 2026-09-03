/**
 * Fields that users are allowed to override in their secret config.
 * These are typically credentials set during dynamic registration or user-specific config.
 *
 * @note used by template and reference secret resolution to control which
 * fields from the user's secret config can override the shared/template config
 */
export const ALLOWED_USER_CONFIG_FIELDS = [
  'clientId',
  'clientSecret',
  'scope',
  'user',
  'username',
  'pass',
  'password',
] as const

/**
 * Fields that should be preserved from the user's template secret config.
 * Includes the template identifier plus all allowed user config fields.
 *
 * @note used by template secret resolution
 */
export const ALLOWED_TEMPLATE_CONFIG_FIELDS = [
  'template',
  ...ALLOWED_USER_CONFIG_FIELDS,
] as const

/**
 * Metadata fields that should NOT appear in the final resolved config.
 * These are used for resolution/lookup, not actual secret configuration.
 *
 * @note used by reference and template secret resolution to strip metadata
 */
export const SECRET_METADATA_FIELDS = ['reference', 'secretId', 'id'] as const
