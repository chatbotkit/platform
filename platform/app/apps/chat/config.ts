import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Chat app.
 *
 * @description Validates the `config` field from app.manifest. The Chat app
 * provides multi-agent management for enhanced AI collaboration.
 */
const ConfigSchema = z
  .object({
    intro: z
      .object({
        title: z
          .string()
          .optional()
          .describe('Optional intro title for the app'),
        text: z.string().optional().describe('Optional intro text for the app'),
      })
      .optional()
      .describe('Optional introductory copy displayed in the app'),

    bots: z
      .array(
        z.union([
          z.string().describe('Bot ID'),
          z
            .object({
              id: z.string().describe('Bot ID'),
              name: z.string().optional().describe('Override display name'),
              description: z
                .string()
                .optional()
                .describe('Override description'),
              nick: z
                .string()
                .optional()
                .describe('Short nickname for the bot'),
              icon: z.string().optional().describe('Icon identifier'),
              default: z
                .boolean()
                .optional()
                .describe('Whether this is the default bot'),
              auto: z
                .boolean()
                .optional()
                .describe('Whether this bot can auto-select other bots'),
              multi: z
                .boolean()
                .optional()
                .describe('Whether this bot can orchestrate multiple bots'),
            })
            .passthrough(),
        ])
      )
      .optional()
      .describe('List of bot configurations'),

    models: z
      .boolean()
      .optional()
      .describe('Whether model selection is enabled'),

    sources: z
      .union([
        z.boolean(),
        z.object({
          datasets: z.boolean().optional().describe('Enable dataset sources'),
          skillsets: z.boolean().optional().describe('Enable skillset sources'),
          spaces: z.boolean().optional().describe('Enable space sources'),
          mcps: z
            .union([
              z.boolean(),
              z.array(
                z.object({
                  id: z.string().describe('MCP server ID'),
                  icon: z.string().optional().describe('MCP server icon'),
                  name: z.string().optional().describe('MCP server name'),
                  description: z
                    .string()
                    .optional()
                    .describe('MCP server description'),
                  url: z.string().describe('MCP server URL'),
                })
              ),
              z.record(
                z.string(),
                z.object({
                  name: z.string().optional().describe('MCP server name'),
                  icon: z.string().optional().describe('MCP server icon'),
                  description: z
                    .string()
                    .optional()
                    .describe('MCP server description'),
                  url: z.string().describe('MCP server URL'),
                })
              ),
            ])
            .optional()
            .describe('MCP sources configuration'),
          web: z
            .union([
              z.boolean(),
              z.object({
                web: z.boolean().optional().describe('Enable web search'),
                news: z.boolean().optional().describe('Enable news search'),
                image: z.boolean().optional().describe('Enable image search'),
                video: z.boolean().optional().describe('Enable video search'),
              }),
            ])
            .optional()
            .describe('Web search configuration'),
          creative: z.boolean().optional().describe('Enable creative sources'),
          shell: z
            .boolean()
            .optional()
            .describe('Enable shell (bash) sandbox tools'),
        }),
      ])
      .optional()
      .describe('Configuration for available source types'),

    save: z
      .boolean()
      .optional()
      .describe('Whether to save conversations (opposite of ephemeral)'),

    ephemeral: z
      .boolean()
      .optional()
      .describe('Whether conversations are ephemeral (not saved)'),
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 11
 *
 * ### Chat Configuration
 *
 * Configure Chat through the `config` field in `app.manifest` or in portal settings.
 *
 * | Field | Type | Description |
 * | --- | --- | --- |
 * | `intro` | `object` | Optional introductory copy displayed in the app |
 * | `bots` | `array` | List of bot configurations |
 * | `models` | `boolean` | Enable or disable model selection for users |
 * | `sources` | `boolean \| object` | Configure available source types |
 * | `save` | `boolean` | Persist conversations |
 * | `ephemeral` | `boolean` | Do not save conversations |
 *
 * ### Intro
 *
 * | Field | Type | Description |
 * | --- | --- | --- |
 * | `title` | `string` | Optional custom intro title displayed in the app |
 * | `text` | `string` | Optional custom intro text displayed in the app |
 *
 * ### Bots
 *
 * Each item in `bots` can be either a bot ID string or an object with the following fields:
 *
 * | Field | Type | Description |
 * | --- | --- | --- |
 * | `id` | `string` | Bot ID |
 * | `name` | `string` | Override display name |
 * | `description` | `string` | Override bot description |
 * | `nick` | `string` | Short nickname |
 * | `icon` | `string` | Icon identifier |
 * | `default` | `boolean` | Mark this bot as the default |
 * | `auto` | `boolean` | Allow this bot to auto-select other bots |
 * | `multi` | `boolean` | Allow this bot to orchestrate multiple bots |
 *
 * ### Sources
 *
 * Set `sources` to `true` or `false` to enable or disable all sources at once, or provide an object to control them individually:
 *
 * | Field | Type | Description |
 * | --- | --- | --- |
 * | `datasets` | `boolean` | Enable dataset sources |
 * | `skillsets` | `boolean` | Enable skillset sources |
 * | `spaces` | `boolean` | Enable space sources |
 * | `mcps` | `boolean \| array \| object` | Configure MCP sources |
 * | `web` | `boolean \| object` | Configure web, news, image, and video search |
 * | `creative` | `boolean` | Enable creative sources |
 * | `shell` | `boolean` | Enable shell (bash) sandbox tools |
 */
