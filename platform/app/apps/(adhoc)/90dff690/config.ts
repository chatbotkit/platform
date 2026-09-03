import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Tokens app (90dff690).
 *
 * @description Validates the `config` field from app.manifest. This app
 * manages API tokens for user authentication.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
