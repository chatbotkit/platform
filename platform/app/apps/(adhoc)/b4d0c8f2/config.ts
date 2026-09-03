import z from '@/lib/zod.schema'

/**
 * Configuration schema for the API Docs app (b4d0c8f2).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides interactive API documentation.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
