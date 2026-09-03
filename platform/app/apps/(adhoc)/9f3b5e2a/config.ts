import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Spaces app (9f3b5e2a).
 *
 * @description Validates the `config` field from app.manifest. This app
 * allows users to create and manage conversation spaces.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
