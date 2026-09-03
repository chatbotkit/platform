// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/list:
 *   get:
 *     operationId: listSkillsetAbilities
 *     summary: Retrieve a list of skillset abilities
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the skillset
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
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           linkedSecretId:
 *                             description: The ID of the secret associated with the ability
 *                             type: string
 *                             nullable: true
 *                           linkedFileId:
 *                             description: The ID of the file associated with the ability
 *                             type: string
 *                             nullable: true
 *                           linkedBotId:
 *                             description: The ID of the bot associated with the ability
 *                             type: string
 *                             nullable: true
 *                           linkedSpaceId:
 *                             description: The ID of the space associated with the ability
 *                             type: string
 *                             nullable: true
 *                           instruction:
 *                             type: string
 *                           state:
 *                             $ref: '#/components/schemas/ResourceState'
 *                         required:
 *                           - name
 *                           - description
 *                           - instruction
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
 *                       $ref: '#/paths/~1skillset~1{skillsetId}~1ability~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const skillset = await prisma.skillset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillsetId')
      )

      if (!skillset) {
        return throwNotFound(`Skillset not found`)
      }

      if (skillset.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const abilities = await prisma.ability.findMany({
        where: {
          AND: [
            { skillsetId: skillset.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          skillsetId: true,

          linkedSecretId: true,

          linkedFileId: true,

          linkedBotId: true,

          linkedSpaceId: true,

          // resource specific

          instruction: true,

          // lifecycle

          state: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(abilities),
      }
    })
  )
)

/**
 * @manual Skillset Abilities
 * @index 10
 *
 * ## Listing Abilities in a Skillset
 *
 * To retrieve all abilities associated with a specific skillset, use the list
 * endpoint. This operation provides a comprehensive view of all capabilities
 * that have been added to a skillset, including their configuration, associated
 * resources, and execution instructions. Understanding which abilities are available
 * in a skillset is essential for managing bot capabilities, troubleshooting skill
 * execution, and auditing skillset compositions.
 *
 * Each ability represents a specific capability or action that bots can perform,
 * such as querying external APIs, processing data, executing custom logic, or
 * integrating with third-party services. When you list abilities, you can see
 * the complete configuration of each ability including its instruction template,
 * linked secrets for authentication, associated files for context, and connected
 * bots that rely on specific abilities.
 *
 * ```http
 * GET /api/v1/skillset/{skillsetId}/ability/list?take=50&order=desc
 * Content-Type: application/json
 * ```
 *
 * You can filter abilities by blueprint association if you're working with
 * blueprint-based skillset organizations:
 *
 * ```http
 * GET /api/v1/skillset/{skillsetId}/ability/list?blueprintId={blueprintId}
 * Content-Type: application/json
 * ```
 *
 * The response includes detailed information about each ability:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "ability_abc123",
 *       "name": "Weather API Query",
 *       "description": "Fetches current weather data from external API",
 *       "instruction": "```fetch\\nmethod: GET\\nurl: https://api.weather.com/v1/current\\n```",
 *       "linkedSecretId": "secret_xyz789",
 *       "linkedFileId": null,
 *       "linkedBotId": null,
 *       "skillsetId": "skillset_def456",
 *       "blueprintId": "blueprint_ghi012",
 *       "meta": {},
 *       "createdAt": "2025-11-20T10:00:00Z",
 *       "updatedAt": "2025-11-22T15:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * **Key Response Fields:**
 *
 * - **instruction**: The ability's execution template defining how it operates (e.g., API calls, data processing)
 * - **linkedSecretId**: Reference to authentication credentials if the ability requires external service access
 * - **linkedFileId**: Associated file providing additional context or code for ability execution
 * - **linkedBotId**: The bot this ability acts on (for example the target of `bot/call`), or null if it acts on none
 * - **blueprintId**: Blueprint organization this ability belongs to, enabling grouped management
 *
 * **Common Use Cases:**
 *
 * - **Capability Auditing**: Review all abilities available in a skillset to understand bot capabilities
 * - **Dependency Management**: Identify which secrets and files are required for skillset operation
 * - **Bot Configuration**: Verify that all necessary abilities are present before deploying a bot
 * - **Troubleshooting**: Examine ability instructions when debugging skill execution issues
 * - **Skillset Cloning**: Export ability configurations when creating duplicate or template skillsets
 *
 * **Pagination:** The list endpoint supports cursor-based pagination for efficient handling
 * of skillsets with many abilities. Use the `cursor`, `order`, and `take` parameters to
 * navigate through large ability collections. The default order is descending by creation date,
 * showing the most recently added abilities first.
 */
