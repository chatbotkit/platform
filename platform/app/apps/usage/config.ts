import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Usage app.
 *
 * @description Validates the `config` field from app.manifest. The Usage app
 * displays token usage metrics and analytics.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 41
 *
 * ### Usage Configuration
 *
 * The Usage app currently has no dedicated configuration fields. It works with an empty `config` object and shows usage analytics without additional setup.
 */
