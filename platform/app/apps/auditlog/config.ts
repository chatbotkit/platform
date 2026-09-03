import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Auditlog app.
 *
 * @description Validates the `config` field from app.manifest. The Auditlog
 * app exposes audit log history using the shared audit log viewer.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 73
 *
 * ### Audit Logs Configuration
 *
 * The Audit Logs app currently has no dedicated configuration fields. It works
 * with an empty `config` object and is ready to use as soon as the app is
 * added.
 */
