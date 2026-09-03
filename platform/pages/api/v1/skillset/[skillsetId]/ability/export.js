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
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/export:
 *   get:
 *     operationId: exportSkillsetAbilities
 *     summary: Export skillset abilities
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset to export
 *           type: string
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
 *         description: The export of skillset abilities was retrieved successfully
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
 *                       $ref: '#/paths/~1skillset~1{skillsetId}~1ability~1export/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *           text/csv:
 *             schema:
 *               type: string
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

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(abilities).map(({ meta, ...rest }) => {
          return {
            ...rest,

            meta: new Proxy(meta || {}, {
              get: function (target, prop) {
                if (prop === 'toString') {
                  return function () {
                    return target ? yaml.stringify(target) : ''
                  }
                }

                return target[prop]
              },
            }),
          }
        }),
      }
    })
  )
)

/**
 * @manual Skillset Abilities
 * @description Skillset Abilities define the specific actions and capabilities that bots can perform, ranging from API integrations and data operations to custom business logic and external service interactions.
 * @category Resources/Skillsets
 * @tags skillsets, abilities, actions, integrations
 * @index 12
 *
 * Skillset Abilities represent the individual actions and capabilities that
 * define what bots can accomplish beyond basic conversation. Each ability
 * encapsulates a specific function, operation, or integration that can be
 * invoked during conversations to perform tasks like fetching data from APIs,
 * executing business logic, interacting with external services, or processing
 * information in specialized ways.
 *
 * Abilities are organized into Skillsets, which are collections of related
 * capabilities that can be attached to bots. This modular approach enables
 * building sophisticated bot behaviors by combining pre-defined abilities,
 * custom integrations, and specialized functions into coherent capability sets.
 *
 * ## Exporting Skillset Abilities
 *
 * Export all abilities within a skillset to retrieve their complete configurations,
 * instructions, and metadata. This endpoint is particularly valuable for backing
 * up skillset configurations, migrating abilities between environments, analyzing
 * capability implementations, or building automated deployment pipelines that
 * version control bot functionality.
 *
 * The export format provides abilities in a machine-readable structure that can
 * be stored, version controlled, analyzed, or re-imported into other skillsets.
 * This enables treating bot capabilities as portable, reusable components that
 * can be shared across projects and environments.
 *
 * ```http
 * GET /api/v1/skillset/{skillsetId}/ability/export
 * ```
 *
 * ### Export Response Structure
 *
 * The export endpoint returns a paginated list of abilities with complete
 * configuration details including ability instructions, linked resources,
 * metadata, and creation timestamps. Each ability in the export includes:
 *
 * **Core Identification**: Ability ID, name, and description that identify the
 * capability and explain its purpose. Names should be descriptive and follow
 * consistent naming conventions to maintain clarity in large skillsets.
 *
 * **Instruction Block**: The complete instruction specification defining how the
 * ability executes. Instructions can reference files, bots, secrets, or contain
 * inline logic using template languages or action definitions. This is the core
 * functional definition of what the ability does.
 *
 * **Resource References**: IDs linking to external resources the ability depends
 * on, including file IDs for stored code or configuration, bot IDs for delegated
 * processing, and secret IDs for authentication credentials. These references
 * ensure abilities can access required resources at runtime.
 *
 * **Blueprint Association**: If the skillset belongs to a blueprint, abilities
 * inherit that blueprint context, enabling coordinated deployments of related
 * resources and capabilities as cohesive packages.
 *
 * **Metadata**: YAML-formatted metadata containing additional configuration,
 * version information, deployment tags, or custom attributes. The metadata
 * field provides extensibility for storing ability-specific settings without
 * modifying the core schema.
 *
 * ### Common Export Use Cases
 *
 * **Configuration Backup and Version Control**:
 * ```javascript
 * // Export all abilities for backup
 * const response = await fetch('/api/v1/skillset/sks_123/ability/export');
 * const { items: abilities } = await response.json();
 *
 * // Store in version control
 * const backup = {
 *   timestamp: Date.now(),
 *   skillsetId: 'sks_123',
 *   abilities: abilities.map(a => ({
 *     name: a.name,
 *     description: a.description,
 *     instruction: a.instruction,
 *     metadata: a.meta.toString() // YAML format
 *   }))
 * };
 *
 * await fs.writeFile(
 *   `skillset-backup-${Date.now()}.json`,
 *   JSON.stringify(backup, null, 2)
 * );
 * ```
 *
 * **Environment Migration**:
 * ```javascript
 * // Export from production
 * const prodExport = await fetch(
 *   'https://api.chatbotkit.com/api/v1/skillset/sks_prod/ability/export',
 *   { headers: { Authorization: `Bearer ${prodToken}` } }
 * );
 * const { items: prodAbilities } = await prodExport.json();
 *
 * // Import to staging, creating new abilities
 * for (const ability of prodAbilities) {
 *   await fetch('/api/v1/skillset/sks_staging/ability/create', {
 *     method: 'POST',
 *     headers: {
 *       Authorization: `Bearer ${stagingToken}`,
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify({
 *       name: ability.name,
 *       description: ability.description,
 *       instruction: ability.instruction
 *     })
 *   });
 * }
 * ```
 *
 * ### Pagination and Large Skillsets
 *
 * The export endpoint supports pagination for skillsets with many abilities.
 * Use the `cursor`, `order`, and `take` query parameters to control pagination:
 *
 * **Cursor-Based Pagination**: The `cursor` parameter enables efficient pagination
 * through large ability collections. After fetching a page, use the last item's
 * ID as the cursor for the next request to continue where you left off.
 *
 * **Order Control**: Set `order` to `asc` for chronological ordering (oldest
 * first) or `desc` for reverse chronological (newest first). This affects both
 * initial results and pagination continuity.
 *
 * **Page Size**: The `take` parameter controls how many abilities are returned
 * per request. Balance between fewer requests (larger pages) and faster individual
 * responses (smaller pages) based on your use case.
 *
 * ### Metadata Format and Usage
 *
 * The `meta` field in exported abilities contains YAML-formatted metadata that
 * can be converted to string format for storage or parsing. This metadata often
 * includes:
 *
 * - **Version Information**: Track ability versions for change management
 * - **Environment Tags**: Mark abilities for specific deployment environments
 * - **Dependencies**: Document required resources or external service versions
 * - **Configuration Options**: Store ability-specific settings and parameters
 * - **Documentation**: Include usage notes, examples, or API references
 *
 * Access metadata in string form using `meta.toString()`, which returns properly
 * formatted YAML suitable for storage or editing.
 *
 * ### Export Analysis and Validation
 *
 * Exported abilities can be analyzed programmatically to ensure consistency,
 * identify dependencies, or validate configurations before deployment:
 *
 * ```javascript
 * // Analyze exported abilities
 * const { items: abilities } = await response.json();
 *
 * // Find abilities with secret dependencies
 * const secretDependencies = abilities
 *   .filter(a => a.linkedSecretId)
 *   .map(a => ({ name: a.name, linkedSecretId: a.linkedSecretId }));
 *
 * // Identify file-based abilities
 * const fileBased = abilities
 *   .filter(a => a.linkedFileId)
 *   .map(a => ({ name: a.name, linkedFileId: a.linkedFileId }));
 *
 * // Validate naming conventions
 * const invalidNames = abilities.filter(a =>
 *   !a.name.match(/^[a-z][a-z0-9-]*[a-z0-9]$/)
 * );
 * ```
 *
 * ### Best Practices for Export Operations
 *
 * **Regular Backups**: Export skillset abilities regularly to maintain backups
 * of your bot capabilities. This provides recovery options if abilities are
 * accidentally modified or deleted, and enables rollback to previous versions.
 *
 * **Documentation Generation**: Use exports to automatically generate capability
 * documentation showing what abilities are available, their purposes, and
 * dependencies. This aids team collaboration and onboarding.
 *
 * **Dependency Mapping**: Analyze exports to understand resource dependencies
 * before making changes. Identifying which abilities depend on specific files
 * or secrets prevents breaking changes.
 *
 * **Environment Consistency**: Compare exports across environments to ensure
 * staging and production maintain consistent capability sets. Differences might
 * indicate incomplete deployments or configuration drift.
 *
 * **Important Note**: Exported abilities contain complete configuration including
 * resource references, but do not include the actual files, secrets, or linked
 * resources themselves. When migrating abilities, ensure dependent resources
 * exist in the destination environment or update references accordingly.
 */
