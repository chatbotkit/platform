import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Inspector app (41f203dc).
 *
 * @description Validates the `config` field from app.manifest. This app
 * inspects the current dashboard resource with related data, events, and
 * audit logs.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
