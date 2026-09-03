// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/{abilityId}/fetch:
 *   get:
 *     operationId: fetchSkillsetAbility
 *     summary: Fetch a ability from a skillset
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset
 *           type: string
 *       - in: path
 *         name: abilityId
 *         required: true
 *         schema:
 *           description: The ID of the ability to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The skillset was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     linkedSecretId:
 *                       description: The ID of the secret associated with the ability
 *                       type: string
 *                       nullable: true
 *                     linkedFileId:
 *                       description: The ID of the file associated with the ability
 *                       type: string
 *                       nullable: true
 *                     linkedBotId:
 *                       description: The ID of the bot associated with the ability
 *                       type: string
 *                       nullable: true
 *                     linkedSpaceId:
 *                       description: The ID of the space associated with the ability
 *                       type: string
 *                       nullable: true
 *                     instruction:
 *                       description: The instruction of the skillset ability
 *                       type: string
 *                     state:
 *                       $ref: '#/components/schemas/ResourceState'
 *                   required:
 *                     - name
 *                     - description
 *                     - instruction
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const skillset = await prisma.skillset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'skillsetId'),
      {
        include: {
          abilities: {
            where: {
              id: requiredUrlParam(req, 'abilityId'),
            },

            take: 1,

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
          },
        },
      }
    )

    if (!skillset) {
      return notFound()
    }

    if (skillset.userId !== session.user.id) {
      return notAuthorized()
    }

    const ability = skillset.abilities[0]

    if (!ability) {
      return notFound()
    }

    return ok(makeJsonSafe(ability))
  })
)

/**
 * @manual Skillset Abilities
 * @index 20
 *
 * ## Fetching Individual Ability Details
 *
 * To retrieve comprehensive information about a specific ability within a skillset,
 * including its instruction template, associated resources, and configuration details,
 * use the fetch endpoint. This operation provides a complete view of how an ability
 * is configured to operate, which external services it integrates with, and what
 * resources it depends on. Understanding ability details is essential for troubleshooting
 * execution issues, auditing capability configurations, and preparing to update or
 * replicate ability definitions.
 *
 * The fetch operation returns the full ability configuration including the instruction
 * template that defines its behavior, references to authentication secrets for external
 * API access, associated files that provide context or code, and linked bots if the
 * ability acts on that bot (for example as the target of `bot/call`); it does not restrict which bots may use the ability.
 *
 * ```http
 * GET /api/v1/skillset/{skillsetId}/ability/{abilityId}/fetch
 * Content-Type: application/json
 * ```
 *
 * The response includes all ability configuration details:
 *
 * ```json
 * {
 *   "id": "ability_abc123",
 *   "name": "Weather API Query",
 *   "description": "Fetches current weather data from OpenWeatherMap API",
 *   "instruction": "```fetch\\nmethod: GET\\nurl: https://api.openweathermap.org/data/2.5/weather\\nheaders:\\n  Authorization: ${SECRET_DEFAULT}\\nquery:\\n  q: ((location! ys|the location to query))\\n  units: metric\\n```",
 *   "linkedSecretId": "secret_xyz789",
 *   "linkedFileId": null,
 *   "linkedBotId": null,
 *   "skillsetId": "skillset_def456",
 *   "blueprintId": "blueprint_ghi012",
 *   "meta": {},
 *   "createdAt": "2025-11-20T10:00:00Z",
 *   "updatedAt": "2025-11-22T15:30:00Z"
 * }
 * ```
 *
 * **Key Response Fields Explained:**
 *
 * **instruction**: The ability's execution template that defines its behavior. This
 * typically contains action definitions such as API calls, data transformations, or
 * custom logic. The instruction uses a specialized format with parameter placeholders
 * and may include multiple action types like `fetch`, `pack`, `bot`, or `dataset`.
 *
 * **linkedSecretId**: Reference to stored authentication credentials used by the ability
 * when accessing external services. When this field is set, the ability can securely
 * authenticate with third-party APIs without exposing credentials in the instruction.
 *
 * **linkedFileId**: Associated file that provides additional context, code, or configuration
 * for the ability. This could be a script, data file, or documentation that supports
 * ability execution.
 *
 * **linkedBotId**: If set, the bot this ability acts on (for example the target of
 * `bot/call`). It does not restrict which bots may use the ability - availability
 * is governed by the skillset, not by this link.
 *
 * **blueprintId**: Blueprint organization this ability belongs to, enabling grouped
 * management and lifecycle control of related abilities.
 *
 * **Common Use Cases:**
 *
 * - **Debugging Execution Issues**: Examine the instruction template when an ability fails to execute correctly
 * - **Configuration Auditing**: Review ability settings to ensure they match expected behavior
 * - **Capability Replication**: Copy ability configurations when creating similar capabilities
 * - **Dependency Verification**: Confirm that required secrets and files are properly associated
 * - **Integration Documentation**: Understand how abilities integrate with external services
 *
 * **Instruction Format:** The instruction field contains structured templates that
 * define how abilities operate. These templates use special syntax for parameters,
 * authentication, and action definitions. Understanding this format is crucial for
 * creating or modifying abilities to match your specific integration requirements.
 */
