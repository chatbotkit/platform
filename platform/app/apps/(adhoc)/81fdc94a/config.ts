import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Secrets app (81fdc94a).
 *
 * @description Validates the `config` field from app.manifest. This app
 * manages shared secrets and OAuth integrations.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
