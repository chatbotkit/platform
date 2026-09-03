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
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/mcpserver/list:
 *   get:
 *     operationId: listMcpServerIntegrations
 *     summary: List McpServer integrations
 *     tags:
 *       - McpServer Integration
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
 *         description: The list of McpServer integrations was retrieved successfully
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
 *                           skillsetId:
 *                             description: The ID of the skillset
 *                             type: string
 *                           oAuthConnectionId:
 *                             description: The ID of the OAuth connection for IdP-based authentication
 *                             type: string
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
 *                       $ref: '#/paths/~1integration~1mcpserver~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const mcpserverIntegrations = await prisma.mcpserverIntegration.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          skillsetId: true,

          oAuthConnectionId: true,

          // resource specific

          // accessToken: true, // disabled for security reasons

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(mcpserverIntegrations),
      }
    })
  )
)

/**
 * @manual MCP Server Integration
 * @category Integrations
 * @index 40
 *
 * ## Listing MCP Server Integrations
 *
 * Retrieving a list of your MCP Server integrations allows you to inventory
 * all configured external connections, review their settings, and manage their
 * associations with other platform resources like skillsets and blueprints.
 * The list endpoint supports pagination and filtering to help you efficiently
 * navigate large numbers of integrations.
 *
 * To retrieve your MCP Server integrations, send a GET request to the list
 * endpoint:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/list
 * ```
 *
 * ### Pagination
 *
 * The list endpoint supports cursor-based pagination for efficient navigation
 * through large result sets. Use the `cursor` parameter to fetch subsequent
 * pages:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/list?cursor=eyJpZCI6Im1jcF8xMjMifQ&take=20
 * ```
 *
 * - **cursor**: Pagination token returned from previous request
 * - **take**: Number of items to retrieve per page (default varies by
 *   implementation)
 * - **order**: Sort order, either `asc` or `desc` (default: `desc`)
 *
 * ### Filtering by Blueprint
 *
 * You can filter integrations associated with specific blueprints:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/list?blueprintId=bp_abc123
 * ```
 *
 * This is particularly useful when managing integrations within the context
 * of a specific project or workflow.
 *
 * ### Filtering by Metadata
 *
 * Filter integrations based on custom metadata fields using deep object
 * notation:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/list?meta[environment]=production&meta[region]=us-east
 * ```
 *
 * Metadata filtering enables flexible organization and retrieval of integrations
 * based on your own tagging and categorization schemes.
 *
 * ### Response Format
 *
 * The endpoint returns a list of integration objects:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "mcp_abc123",
 *       "name": "Custom Analytics Service",
 *       "description": "Integration with internal analytics platform",
 *       "blueprintId": "bp_xyz789",
 *       "skillsetId": "skill_def456",
 *       "meta": {
 *         "environment": "production",
 *         "version": "2.0"
 *       },
 *       "createdAt": "2025-01-15T10:30:00.000Z",
 *       "updatedAt": "2025-01-16T14:20:00.000Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ### Streaming Response (JSONL)
 *
 * For real-time processing of large result sets, the endpoint supports JSONL
 * (JSON Lines) streaming format. Set the Accept header to request streaming:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/list
 * Accept: application/jsonl
 * ```
 *
 * Each line in the response stream is a JSON object:
 *
 * ```jsonl
 * {"type":"item","data":{"id":"mcp_abc123","name":"Service 1",...}}
 * {"type":"item","data":{"id":"mcp_def456","name":"Service 2",...}}
 * ```
 *
 * **Important Notes:**
 *
 * - Only integrations owned by the authenticated user are returned
 * - The skillsetId field indicates which skillset the integration is linked to,
 *   determining what abilities are available through the MCP server
 * - Blueprint associations allow grouping integrations with related resources
 *   for complex workflows
 * - Metadata is flexible and can store arbitrary key-value pairs for custom
 *   organization and filtering
 */
