// @ts-check
import prisma from '@/prisma/client'

import {
  ImportError,
  ensureBlueprintByAlias,
  findReusableBlueprintByResourceAliases,
  getEnsurableAlias,
  importBlueprintResources,
  parseCategoryArrayResources,
  planImportOrder,
} from '@/lib/blueprint.import'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  BAD_REQUEST_CODE,
  BAD_REQUEST_STATUS,
  badRequest,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'

// @note a resource import is a bulk operation - a full blueprint can carry dozens
// of resources - so the default (short) transaction timeout is not enough for a
// large payload on a cold/slow database. Give it ample headroom; the transaction
// only touches the caller's own freshly-created rows, so it holds no contended
// locks. (The underlying database may impose its own lower ceiling.)
const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000

const bodySchema = schema
  .object({
    // @note when true, a blueprint addressed by @alias is created if it does
    // not exist yet (idempotent provision), mirroring contact/ensure
    ensure: schema.boolean().default(false),

    resources: schema
      .object()
      .pattern(
        /./,
        schema.array().items(schema.object().pattern(/./, schema.any()))
      )
      .required(),
  })
  // @note allow a full export envelope (id, name, config, meta, ...) to be
  // posted as-is; only the resources map is consumed
  .unknown(true)

/**
 * Builds the structured 400 response carrying issue details.
 *
 * @param {string} message
 * @param {Record<string, any>} details
 * @returns {Response}
 */
function badRequestWithDetails(message, details) {
  return new Response(
    JSON.stringify({
      message,
      code: BAD_REQUEST_CODE,
      details,
    }),
    {
      status: BAD_REQUEST_STATUS,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Maps a parse failure to the original per-reason response.
 *
 * @param {{ reason: 'invalid' | 'empty' | 'duplicate', issues: any[] }} result
 * @returns {Response}
 */
function parseFailureResponse(result) {
  if (result.reason === 'invalid') {
    return badRequestWithDetails(`Invalid resource payload`, {
      issues: result.issues,
    })
  }

  if (result.reason === 'duplicate') {
    return badRequestWithDetails(`Duplicate resource ids found`, {
      issues: result.issues,
    })
  }

  return badRequest(`Resource payload does not contain any entries`)
}

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/resource/import:
 *   post:
 *     operationId: importBlueprintResources
 *     summary: Import resources into an existing blueprint
 *     description: Reconciles resources by alias. A resource whose alias already exists in the blueprint is updated in place (credentials are preserved); otherwise it is created. Resources without an alias are always created. Caller-provided ids are used only to wire up references within the payload.
 *     tags:
 *       - Blueprint Resources
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ensure:
 *                 description: When true and the blueprint is addressed by the caller's own @alias, it is created if it does not exist yet (idempotent provision). Ignored for a raw id, which still 404s on miss.
 *                 type: boolean
 *               resources:
 *                 type: object
 *             required:
 *               - resources
 *     responses:
 *       200:
 *         description: Resources were imported successfully
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { resources } = body

      /** @type {ReturnType<typeof parseCategoryArrayResources> | null} */
      let parsed = null

      const getParsed = () => {
        if (!parsed) {
          parsed = parseCategoryArrayResources(resources)
        }

        return parsed
      }

      const identifier = requiredUrlParam(req, 'blueprintId')

      let blueprint = await prisma.blueprint.findUniqueByIdentifier(
        session.user,
        identifier,
        {
          select: {
            id: true,
            userId: true,
            alias: true,
          },
        }
      )

      if (!blueprint) {
        // @note ensure: create/reuse the blueprint when it is addressed by the
        // caller's own @alias and does not exist yet. A raw id (or @@/@user@…)
        // is never created - it stays a 404.

        const ensurableAlias = body.ensure
          ? getEnsurableAlias(identifier, aliasSchema)
          : null

        if (!ensurableAlias) {
          return notFound()
        }

        const result = getParsed()

        if (!result.ok) {
          return parseFailureResponse(result)
        }

        const reusable = await findReusableBlueprintByResourceAliases(
          prisma,
          result.nodesById,
          session.user.id
        )

        if (reusable.issues.length) {
          return badRequestWithDetails(`Failed to import blueprint resources`, {
            issues: reusable.issues,
          })
        }

        blueprint =
          reusable.blueprint ||
          (await ensureBlueprintByAlias(session.user, ensurableAlias))
      }

      if (blueprint.userId !== session.user.id) {
        return notAuthorized()
      }

      const result = getParsed()

      if (!result.ok) {
        return parseFailureResponse(result)
      }

      // @note order (and the cyclic check) runs before any transaction opens

      let plan

      try {
        plan = planImportOrder(result.nodesById)
      } catch (error) {
        return badRequestWithDetails(
          error instanceof ImportError
            ? error.message
            : `Failed to import blueprint resources`,
          {
            issues:
              error instanceof ImportError
                ? error.details.issues
                : [{ error: 'resource_import_failed' }],
          }
        )
      }

      try {
        const imported = await prisma.$transaction(
          (tx) =>
            importBlueprintResources({
              tx,
              user: session.user,
              targetBlueprint: blueprint,
              nodesById: result.nodesById,
              sortedNodeIds: plan.sortedNodeIds,
              importedNodeIds: plan.importedNodeIds,
              policy: 'sync',
            }),
          { timeout: IMPORT_TRANSACTION_TIMEOUT_MS }
        )

        return ok({
          id: blueprint.id,
          resources: imported.resources,
        })
      } catch (error) {
        return badRequestWithDetails(`Failed to import blueprint resources`, {
          issues:
            error instanceof ImportError
              ? error.details.issues
              : [
                  {
                    error: 'resource_import_failed',
                    // @ts-ignore
                    message: error?.message || 'Unknown resource import error',
                    // @ts-ignore
                    code: error?.code,
                  },
                ],
        })
      }
    })
  )
)

/**
 * @manual Blueprint Resources
 * @index 37
 *
 * ## Importing Blueprint Resources
 *
 * The import endpoint allows you to bulk-create resources into an existing blueprint in a single atomic transaction. This is particularly useful when restoring a blueprint from an export, migrating resources from another environment, or programmatically seeding a blueprint with a predefined set of resources.
 *
 * When you import resources, the platform ignores any `id` values provided in the payload and generates new platform-managed identifiers for all resources. Cross-references between imported resources (such as a bot referencing a dataset by ID) are automatically resolved using the new generated IDs, so the internal relationships are preserved without any manual ID mapping on your part.
 *
 * ### Resource Payload Format
 *
 * The request body must include a `resources` object whose keys are resource category names (e.g. `bot`, `dataset`, `skillset`, `widgetIntegration`) and whose values are arrays of resource objects. Each resource object must include an `id` field (used only to resolve cross-references within the payload) plus the fields supported by that resource type.
 *
 * This is the same shape produced by the export endpoint, so a full export envelope (including its `id`, `name`, `config`, and `meta` fields) can be posted as-is - only the `resources` map is consumed.
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/resource/import
 * Content-Type: application/json
 *
 * {
 *   "resources": {
 *     "dataset": [
 *       { "id": "local-dataset-1", "name": "My Dataset", "description": "A knowledge base" }
 *     ],
 *     "bot": [
 *       { "id": "local-bot-1", "name": "My Bot", "datasetId": "local-dataset-1" }
 *     ]
 *   }
 * }
 * ```
 *
 * In the example above, `local-dataset-1` and `local-bot-1` are temporary local identifiers used only to wire up the relationship between the bot and dataset. The platform replaces them with real IDs upon creation and correctly maps `datasetId` on the bot to the newly created dataset's real ID.
 *
 * ### Supported Resource Categories
 *
 * The following category keys are accepted: `bot`, `dataset`, `skillset`, `ability`, `secret`, `file`, `portal`, `space`, `extractIntegration`, `notionIntegration`, `sitemapIntegration`, `supportIntegration`, `emailIntegration`, `triggerIntegration`, `widgetIntegration`, `slackIntegration`, `discordIntegration`, `telegramIntegration`, `whatsappIntegration`, `messengerIntegration`, `instagramIntegration`, `twilioIntegration`, and `mcpserverIntegration`.
 *
 * ### Dependency Resolution and Error Handling
 *
 * The import operation performs a topological sort to determine the correct creation order for resources that reference each other. If cyclic dependencies are detected (e.g. resource A references resource B which references resource A), the request fails with a `400 Bad Request` and a detailed error payload describing the cycle. All resources are created inside a single database transaction, so if any resource fails validation or creation, the entire import is rolled back and no partial state is saved.
 *
 * **Note:** The blueprint must already exist and belong to the authenticated user. Attempting to import into a blueprint you do not own will return a `401 Unauthorized` response.
 */
