import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Task app.
 *
 * @description Validates the `config` field from app.manifest. The Task app
 * allows users to automate tasks using conversational AI.
 */
const ConfigSchema = z
  .object({
    bots: z
      .array(z.union([z.string(), z.object({ id: z.string() }).passthrough()]))
      .optional()
      .describe(
        'List of bot IDs or bot configurations allowed for task creation'
      ),
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 51
 *
 * ### Task Configuration
 *
 * Configure Task through the `config` field in `app.manifest` or in portal settings.
 *
 * | Field | Type | Description |
 * | --- | --- | --- |
 * | `bots` | `array` | Restrict task creation to specific bots |
 *
 * Each item in `bots` can be either a bot ID string or an object that includes an `id` field. When you provide this list, only those bots are available for creating tasks. If you omit it, Task can use any available bot.
 */
