import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Tasks app (8734d1ad).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides task automation with built-in task templates.
 */
const ConfigSchema = z
  .object({
    tasks: z
      .array(
        z.object({
          name: z.string().optional().describe('Task name'),
          description: z.string().optional().describe('Task description'),
          botId: z.string().optional().describe('Bot ID to use for this task'),
          schedule: z.string().optional().describe('Schedule frequency'),
          icon: z.string().optional().describe('Icon identifier'),
        })
      )
      .optional()
      .describe('List of built-in task templates'),
  })
  .passthrough()

export default ConfigSchema
