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
 * /integration/notion/{notionIntegrationId}/fetch:
 *   get:
 *     operationId: fetchNotionIntegration
 *     summary: Fetch a notionIntegration
 *     tags:
 *       - Notion Integration
 *     parameters:
 *       - in: path
 *         name: notionIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Notion integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Notion integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     datasetId:
 *                       description: The ID of the dataset to sync into
 *                       type: string
 *                     token:
 *                       description: The Notion API token (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     syncStatus:
 *                       $ref: '#/components/schemas/SyncStatus'
 *                     syncSchedule:
 *                       description: The sync schedule
 *                       type: string
 *                     lastSyncedAt:
 *                       description: The timestamp of the last successful sync
 *                       type: string
 *                       format: date-time
 *                     expiresIn:
 *                       description: The time in milliseconds until records expire
 *                       type: number
 *                   required:
 *                     - datasetId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const notionIntegration =
      await prisma.notionIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'notionIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            datasetId: true,

            // resource specific

            token: true,

            syncStatus: true,
            syncSchedule: true,
            lastSyncedAt: true,

            expiresIn: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!notionIntegration) {
      return notFound()
    }

    if (notionIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (notionIntegration).userId)

    if (notionIntegration.token) {
      /** @type {any} */ notionIntegration.token = '********'
    }

    return ok(makeJsonSafe(notionIntegration))
  })
)

/**
 * @manual Notion Integration
 * @index 20
 *
 * ## Fetching Notion Integration Details
 *
 * To retrieve detailed information about a specific Notion integration, including
 * its configuration, dataset association, and sync settings, you can use the fetch
 * endpoint. This operation allows you to inspect the current state of a Notion
 * integration and verify its configuration before making updates or managing
 * its lifecycle.
 *
 * The fetch operation returns comprehensive information about the Notion integration
 * including the linked dataset, synchronization schedule, token status (returned
 * as masked for security), and record expiration settings. This is particularly
 * useful when you need to audit integration configurations, troubleshoot sync
 * issues, or prepare for updates to integration parameters.
 *
 * ```http
 * GET /api/v1/integration/notion/{notionIntegrationId}/fetch
 * Content-Type: application/json
 * ```
 *
 * The response includes all configuration details:
 *
 * ```json
 * {
 *   "id": "notion_abc123",
 *   "name": "Company Wiki Sync",
 *   "description": "Syncs content from company Notion workspace",
 *   "datasetId": "dataset_xyz789",
 *   "token": "********",
 *   "syncSchedule": "@daily",
 *   "expiresIn": 2592000000,
 *   "blueprintId": "blueprint_def456",
 *   "meta": {},
 *   "createdAt": "2025-11-20T10:00:00Z",
 *   "updatedAt": "2025-11-22T15:30:00Z"
 * }
 * ```
 *
 * **Security Note:** The Notion API token is always returned as `********` (masked)
 * in fetch responses to protect sensitive credentials. The actual token value is
 * never exposed through the API after initial configuration. If the token field
 * is `null`, it indicates that no token has been configured for this integration.
 *
 * **Important:** The `syncSchedule` field determines how often the integration
 * automatically synchronizes content from Notion. Common values include `@daily`,
 * `@hourly`, and `@weekly`. The `expiresIn` field specifies the time in milliseconds
 * after which imported records are considered stale and may be re-synced.
 */
