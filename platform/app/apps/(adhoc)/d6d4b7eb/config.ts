import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Profile app (d6d4b7eb).
 *
 * @description Validates the `config` field from app.manifest. This app
 * allows users to view and update their contact profile.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
