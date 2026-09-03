import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Live Automations app (6e3b7f2a).
 *
 * @description Validates the `config` field from app.manifest. This app is a
 * developer monitor for active tasks and trigger integrations.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
