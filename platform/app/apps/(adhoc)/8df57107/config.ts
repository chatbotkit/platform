import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Agents/Blueprints app (8df57107).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides blueprint and bot management capabilities.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
