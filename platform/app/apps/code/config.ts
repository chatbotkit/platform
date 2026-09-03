import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Code app.
 *
 * @description Validates the `config` field from app.manifest. The Code app
 * mints stateless coding tokens and currently has no configurable fields.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
