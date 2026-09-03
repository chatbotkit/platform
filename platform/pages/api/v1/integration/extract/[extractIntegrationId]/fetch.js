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
 * /integration/extract/{extractIntegrationId}/fetch:
 *   get:
 *     operationId: fetchExtractIntegration
 *     summary: Fetch a extractIntegration
 *     tags:
 *       - Extract Integration
 *     parameters:
 *       - in: path
 *         name: extractIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Extract integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Extract integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     botId:
 *                       description: The ID of the Bot to use
 *                       type: string
 *                     schema:
 *                       description: The configured extraction schema
 *                       type: object
 *                       additionalProperties: true
 *                     request:
 *                       description: Optional webhook to receive the extracted data
 *                       type: string
 *                     model:
 *                       description: The language model to use for data extraction
 *                       type: string
 *                   required:
 *                     - botId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const extractIntegration =
      await prisma.extractIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'extractIntegrationId'),
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

            botId: true,

            // resource specific

            schema: true,

            request: true,

            model: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!extractIntegration) {
      return notFound()
    }

    if (extractIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (extractIntegration).userId)

    return ok(makeJsonSafe(extractIntegration))
  })
)

/**
 * @manual Extract Integration
 *
 * ## Fetching an Extract Integration
 *
 * Retrieving the details of a specific extract integration allows you to review
 * its configuration, including the extraction schema, webhook settings, and
 * associated bot information. This is essential for auditing your data extraction
 * setup and troubleshooting any issues.
 *
 * ```http
 * GET /api/v1/integration/extract/{extractIntegrationId}/fetch
 * ```
 *
 * The response includes the complete integration configuration:
 *
 * - **Schema Definition**: The full JSON schema used for data extraction
 * - **Webhook Configuration**: The request URL and settings for receiving extracted data
 * - **Bot Association**: The bot ID if the integration is linked to a specific bot
 * - **Blueprint Linking**: The blueprint ID if the integration is part of a larger blueprint
 * - **Metadata**: Any custom metadata attached to the integration
 * - **Timestamps**: Creation and last update times
 *
 * This information is valuable when you need to verify your extraction configuration
 * before processing conversations or when debugging extraction results that don't
 * match your expectations.
 */
