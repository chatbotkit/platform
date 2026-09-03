import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Datasets app (3e882a70).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides dataset management and file attachment capabilities.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
