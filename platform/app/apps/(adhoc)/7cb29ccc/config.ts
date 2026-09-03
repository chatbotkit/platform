import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Reports app (7cb29ccc).
 *
 * @description Validates the `config` field from app.manifest. This app
 * displays overview reports and analytics.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
