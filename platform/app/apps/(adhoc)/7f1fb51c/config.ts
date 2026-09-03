import z from '@/lib/zod.schema'

/**
 * Configuration schema for the API Specification app (7f1fb51c).
 *
 * @description Validates the `config` field from app.manifest. This app
 * displays the interactive API specification using Swagger UI.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
