import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Priority Hub app.
 *
 * @description Validates the `config` field from app.manifest. Each configured
 * bot will be queried to identify the user's top priorities.
 */
const ConfigSchema = z
  .object({
    bots: z
      .array(
        z.union([
          z.string(),
          z.object({
            id: z.string().describe('The bot ID'),
            name: z
              .string()
              .optional()
              .describe('Optional display name for the bot'),
            priorityPrompt: z
              .string()
              .optional()
              .describe(
                'Custom prompt to ask the bot for priorities. Defaults to asking for top priorities.'
              ),
          }),
        ])
      )
      .optional()
      .describe(
        'List of bot IDs or bot configurations to query for priorities'
      ),
    maxPrioritiesPerBot: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of priorities to fetch from each bot'),
    totalMaxPriorities: z
      .number()
      .optional()
      .default(5)
      .describe('Total maximum priorities to display'),
  })
  .passthrough()

export default ConfigSchema
