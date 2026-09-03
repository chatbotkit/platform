// @ts-check
import prisma from '@/prisma/client'

import {
  CLONE_EXPORT_BUCKETS,
  exportResourceCategoryMap,
} from '@/lib/blueprint.export'
import {
  importBlueprintResources,
  parseCategoryArrayResources,
  planImportOrder,
} from '@/lib/blueprint.import'
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'
import { captureException } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getRandomId } from '@/lib/string'

export const bodySchema = schema.object({})

/**
 * Projects a cloned resource down to the response shape: identity, name,
 * description, reference (`*Id`) fields, and meta.
 *
 * @param {Record<string, any>} resource
 * @returns {Record<string, any>}
 */
function projectClonedResource({ id, name, description, meta, ...rest }) {
  return {
    id,

    name,
    description,

    ...Object.fromEntries(
      Object.entries(rest).filter(([key]) => key.endsWith('Id'))
    ),

    meta,
  }
}

/**
 * Builds the clone response from a re-loaded blueprint's grouped resources,
 * mirroring the category naming used elsewhere (integration categories gain the
 * `Integration` suffix). Compliance resources are intentionally omitted, as in
 * the original endpoint.
 *
 * @param {Record<string, Record<string, any[]>>} resources
 * @returns {Record<string, any[]>}
 */
function projectClonedResources(resources) {
  const project = (
    /** @type {[string, any[]]} */ [category, items],
    suffix
  ) => [`${category}${suffix}`, items.map(projectClonedResource)]

  return {
    ...Object.fromEntries(
      Object.entries(resources.basic).map((entry) => project(entry, ''))
    ),
    ...Object.fromEntries(
      Object.entries(resources.object).map((entry) => project(entry, ''))
    ),
    ...Object.fromEntries(
      Object.entries(resources.oauth).map((entry) => project(entry, ''))
    ),
    ...Object.fromEntries(
      Object.entries(resources.integration).map((entry) =>
        project(entry, 'Integration')
      )
    ),
  }
}

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/clone:
 *   post:
 *     operationId: cloneBlueprint
 *     summary: Clone a blueprint
 *     tags:
 *       - Blueprint
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to clone
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The blueprint was cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the cloned blueprint
 *                   type: string
 *                 resources:
 *                   description: A map of the resources that were cloned
 *                   type: object
 *               required:
 *                 - id
 *                 - resources
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session) {
      const blueprintAndResources = await getBlueprintAndCloneableResources(
        requiredUrlParam(req, 'blueprintId')
      )

      if (!blueprintAndResources) {
        return notFound()
      }

      const blueprint = blueprintAndResources.blueprint

      // @note clone of an owned blueprint, or any publicly listed hub blueprint
      // @todo also clone by checking if the blueprint is protected and owned by the parent user or sibling

      if (blueprint.userId !== session.user.id && !blueprint.hubBlueprintPage) {
        return notAuthorized()
      }

      // @note build the clone document from the full cloneable set. `public`
      // sensitivity strips credentials (incl. secret values); slugs are
      // regenerated so portals never collide.

      const categoryMap = exportResourceCategoryMap({
        resources: blueprintAndResources.resources,
        sensitivity: 'public',
        buckets: CLONE_EXPORT_BUCKETS,
      })

      if (categoryMap.portals) {
        categoryMap.portals = categoryMap.portals.map((portal) => ({
          ...portal,

          // @note randomise the slug to avoid conflicts with the source portal

          slug: getRandomId(
            /** @type {string | undefined} */ (portal.slug),
            '-'
          ),
        }))
      }

      const parsed = parseCategoryArrayResources(categoryMap)

      // @note an empty source clones to an empty blueprint; any other parse
      // failure would mean an internally-produced document is malformed

      if (!parsed.ok && parsed.reason !== 'empty') {
        return conflict()
      }

      const sourcePositions =
        /** @type {Record<string, any>} */ (blueprint.config?.positions) || {}

      let newBlueprintId

      try {
        const plan = parsed.ok ? planImportOrder(parsed.nodesById) : null

        // @note one atomic transaction: target blueprint + all resources + the
        // remapped design positions. Anything that throws (ordering, validation,
        // a reference failure) rolls the whole thing back.

        const result = await prisma.$transaction(async (tx) => {
          const { id: createdBlueprintId } = await tx.blueprint.create({
            data: {
              name: blueprint.name,
              description: blueprint.description,

              userId: session.user.id,
            },

            select: {
              id: true,
            },
          })

          /** @type {Map<string, string>} */
          let idMap = new Map()

          if (parsed.ok && plan) {
            const imported = await importBlueprintResources({
              tx,
              user: session.user,
              targetBlueprint: {
                id: createdBlueprintId,
                userId: session.user.id,
                alias: null,
              },
              nodesById: parsed.nodesById,
              sortedNodeIds: plan.sortedNodeIds,
              importedNodeIds: plan.importedNodeIds,
              policy: 'clone',
            })

            idMap = imported.idMap
          }

          // @note remap design-position keys from source resource ids to the
          // freshly cloned ids. Drop any position whose source id was not
          // cloned (a stale entry, or an excluded category like oauth) so a
          // foreign source id never survives into the clone's canvas config.

          await tx.blueprint.update({
            where: {
              id: createdBlueprintId,
            },
            data: {
              config: {
                positions: Object.fromEntries(
                  Object.entries(sourcePositions).flatMap(([key, value]) => {
                    const mapped = idMap.get(key)

                    return mapped ? [[mapped, value]] : []
                  })
                ),
              },
            },
          })

          return { newBlueprintId: createdBlueprintId }
        })

        newBlueprintId = result.newBlueprintId
      } catch (error) {
        // @note the source document is internally produced, so an ordering /
        // validation / reference failure is an inconsistency, not caller error
        // and the transaction guarantees nothing was committed. Capture it so a
        // transient infra failure (deadlock, transaction-budget timeout) is not
        // silently indistinguishable from a malformed-document conflict.

        await captureException(error)

        return conflict()
      }

      const newBlueprintAndResources =
        await getBlueprintAndCloneableResources(newBlueprintId)

      if (!newBlueprintAndResources) {
        return conflict()
      }

      return ok({
        id: newBlueprintId,
        resources: projectClonedResources(newBlueprintAndResources.resources),
      })
    })
  )
)

/**
 * @manual Blueprints
 * @index 30
 *
 * ## Cloning a Blueprint
 *
 * Blueprint cloning is one of the most powerful features for creating reusable AI configurations. When you clone a blueprint, you create a complete, independent copy of the entire blueprint structure including all associated resources, making it easy to replicate complex setups or share templates across different environments.
 *
 * The cloning operation creates deep copies of the blueprint and all its contained resources, including bots, datasets, skillsets, abilities, secrets, files, portals, and integrations. All relationships between resources are preserved in the cloned version, and resource identifiers are automatically updated to maintain referential integrity.
 *
 * To clone a blueprint, send a POST request with the blueprint ID you want to clone:
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/clone
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response includes the ID of the newly created blueprint and a comprehensive map of all cloned resources, showing the relationship between original and cloned resource IDs. This mapping is useful for tracking which resources were created and for any post-clone processing you need to perform.
 *
 * ### What Gets Cloned
 *
 * The cloning operation creates copies of the following resources:
 * - **Bots**: All bot configurations including backstory, model settings, and parameters
 * - **Datasets**: Complete datasets with structure and configuration (records are not cloned)
 * - **Skillsets**: All skillset definitions and configurations
 * - **Abilities**: Custom abilities and their configurations
 * - **Secrets**: Secret placeholders (values are intentionally not copied for security)
 * - **Files**: File references and metadata
 * - **Portals**: Portal configurations with new unique slugs to avoid conflicts
 * - **Integrations**: All integration types including widget, Slack, Discord, Telegram, WhatsApp, Messenger, Twilio, email, trigger, sitemap, Notion, extract, support, and MCP server integrations
 *
 * ### Resource Reference Handling
 *
 * One of the most sophisticated aspects of blueprint cloning is how it handles resource references. When resources reference each other (for example, a bot referencing a dataset), the cloning process automatically updates these references to point to the newly created resources. This ensures the cloned blueprint maintains the same functional relationships as the original.
 *
 * For example, if the original blueprint has a bot that uses a specific dataset, the cloned bot will automatically reference the cloned version of that dataset rather than the original one.
 *
 * ### Security and Data Handling
 *
 * **Secret Values**: For security reasons, secret values are deliberately not copied during cloning. The cloned resources will have secret placeholders, but you'll need to configure actual secret values manually after cloning.
 *
 * **Authentication Tokens**: Integrations that use authentication tokens (like Trigger integrations, WhatsApp, Messenger, and MCP server integrations) receive new automatically generated tokens to ensure security and prevent conflicts.
 *
 * **Portal Slugs**: Portal slugs are automatically modified to include a random suffix, preventing conflicts with existing portals while maintaining a similar naming pattern.
 *
 * ### Cloning Public Blueprints
 *
 * You can clone public blueprints from the hub or from other users, allowing you to use community-created templates as starting points for your own configurations. When cloning a public blueprint, all resources are copied to your account, and you become the owner of the cloned version with full control over modifications.
 *
 * ### Post-Clone Tasks
 *
 * After cloning a blueprint, you typically need to:
 * 1. **Configure Secrets**: Add actual secret values for any integrations or abilities that require them
 * 2. **Update Authentication**: Configure API keys and tokens for external integrations
 * 3. **Customize Resources**: Modify cloned resources to fit your specific use case
 * 4. **Test Functionality**: Verify that all components work correctly in their new context
 * 5. **Update Portal Slugs**: Adjust portal slugs to match your preferred naming convention if needed
 *
 * **Performance Note:** Cloning large blueprints with many resources may take several seconds to complete as each resource is individually created and linked. The operation is performed atomically to ensure consistency.
 */
