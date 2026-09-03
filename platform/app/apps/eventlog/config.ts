import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Eventlog app.
 *
 * @description Validates the `config` field from app.manifest. The Eventlog app
 * provides advanced event log analysis and viewing capabilities.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 71
 *
 * ### Event Logs Configuration
 *
 * The Event Logs app currently has no dedicated configuration fields. It works with an empty `config` object and is ready to use as soon as the app is added.
 */
