// @ts-check
import abilitiesData from '@/data/abilities/visible'

import { withStreamCursor } from '@/lib/stream'
import { convertToCallableTemplateInstruction } from '@/lib/instruction.convert'
import { extractInstructionFields } from '@/lib/instruction.field'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { toKebabCase } from '@/lib/string'

/**
 * @swagger
 *
 * /platform/ability/list:
 *   get:
 *     operationId: listPlatformAbilities
 *     summary: Retrieve a list of platform abilities
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of abilities was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           template:
 *                             type: string
 *                             description: The original template identifier for the ability
 *                           instruction:
 *                             type: string
 *                           schema:
 *                             allOf:
 *                               - $ref: '#/components/schemas/JsonSchemaObject'
 *                           bot:
 *                             type: string
 *                             description: The ID of the bot associated with the ability
 *                           file:
 *                             type: string
 *                             description: The ID of the file associated with the ability
 *                           secret:
 *                             type: string
 *                             description: The ID of the secret associated with the ability
 *                           space:
 *                             type: string
 *                             description: The ID of the space associated with the ability
 *                           provider:
 *                              type: string
 *                              description: The provider of the ability
 *                           icon:
 *                             type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           setup:
 *                             type: string
 *                           commentary:
 *                             type: string
 *                         required:
 *                           - instruction
 *                           - schema
 *                           - icon
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1platform~1ability~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor) {
      if (cursor) {
        return {
          items: [],
        }
      }

      return {
        items: Object.entries(abilitiesData).map(
          ([
            template,
            {
              name,
              description,

              instruction,

              bot,
              file,
              secret,
              space,

              provider,

              icon,
              tags,

              setup,
              commentary,
            },
          ]) => {
            // @note extract all instruction fields and filter to only placeholders (round bracket fields)
            const allFields = extractInstructionFields(instruction)
            const fields = allFields.filter((field) => field.placeholder)

            const schema = {
              type: 'object',

              properties: Object.fromEntries(
                fields.map((field) => {
                  return [
                    field.name,
                    {
                      ...(field.description != null
                        ? { description: field.description }
                        : {}),

                      ...(field.type != null ? { type: field.type } : {}),

                      ...(field.enum != null ? { enum: field.enum } : {}),

                      ...(field.default != null
                        ? { default: field.default }
                        : {}),
                    },
                  ]
                })
              ),

              required: Array.from(
                new Set(
                  fields
                    .filter((field) => field.required)
                    .map((field) => field.name)
                )
              ),
            }

            // @note example templates return raw instruction, non-examples return callable template instruction

            const isExample =
              template.startsWith('example') || tags?.includes('example')

            const processedInstruction = isExample
              ? instruction
              : convertToCallableTemplateInstruction({ template, instruction })

            return {
              id: toKebabCase(template),

              template,

              name,
              description,

              instruction: processedInstruction,

              schema,

              bot,
              file,
              secret,
              space,

              provider,

              icon,

              tags,

              setup,

              commentary,

              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
        ),
      }
    })
  )
)

/**
 * @manual Platform Abilities
 * @description Abilities are reusable, configurable capabilities that extend the functionality of conversational AI agents, enabling them to perform specialized tasks and interact with external services.
 * @category Platform
 * @tags abilities, platform, capabilities
 * @index 10
 *
 * Abilities represent pre-built, configurable functionality that you can integrate
 * into your conversational AI agents. Each ability encapsulates specific
 * capabilities such as web searching, code execution, file processing, or
 * integration with external services like Google Calendar, Notion, or Slack.
 *
 * ## Discovering Available Abilities
 *
 * The platform provides a comprehensive catalog of abilities that you can
 * browse and integrate into your applications. Each ability comes with a
 * detailed schema defining its configuration parameters, making it easy to
 * understand what inputs are required and how to configure the ability for
 * your specific use case.
 *
 * To retrieve the list of all available platform abilities, send a GET request
 * to the abilities endpoint:
 *
 * ```http
 * GET /api/v1/platform/ability/list
 * ```
 *
 * The response includes an array of ability objects, each containing:
 *
 * - **id**: URL-safe kebab-case slug derived from the template key (e.g., `google-calendar-event-list`)
 * - **template**: The original catalogue identifier for the ability (e.g., `google/calendar/event/list`)
 * - **name**: Human-readable name of the ability
 * - **description**: Detailed explanation of what the ability does
 * - **icon**: Visual icon identifier for UI representation
 * - **instruction**: The ability instruction template (ready to use)
 * - **tags**: Array of tags for categorization and filtering
 * - **schema**: JSON schema defining configuration parameters
 * - **setup**: Optional setup instructions for the ability
 * - **commentary**: Additional context or usage notes
 *
 * ## Understanding Ability Schemas
 *
 * Each ability includes a JSON schema that defines its configuration structure.
 * The schema specifies the parameters that can be configured, their types,
 * whether they're required or optional, enumerated values for select fields,
 * and default values. This schema-driven approach ensures type safety and
 * provides clear documentation for how to configure each ability.
 *
 * ```javascript
 * {
 *   "id": "web-search",
 *   "template": "web/search",
 *   "name": "Web Search",
 *   "description": "Search the web for information",
 *   "instruction": "template: \"web/search\"\\nparameters:\\n  query: ...",
 *   "tags": ["search", "web"],
 *   "schema": {
 *     "type": "object",
 *     "parameters": {
 *       "query": {
 *         "type": "string",
 *         "title": "Search Query"
 *       },
 *       "maxResults": {
 *         "type": "number",
 *         "default": 10
 *       }
 *     },
 *     "required": ["query"]
 *   }
 * }
 * ```
 *
 * ## Integration Considerations
 *
 * When integrating abilities into your agents or applications, review the
 * schema carefully to understand configuration requirements. Some abilities
 * may require external API keys or authentication credentials, which should
 * be securely stored and referenced through the platform's secret management
 * system. The `setup` field provides guidance on any prerequisite steps needed
 * before using an ability.
 *
 * **Note:** The list of available abilities may vary based on your subscription
 * plan and account permissions. Some advanced abilities may require specific
 * plan levels or additional configuration.
 */
