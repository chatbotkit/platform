import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { registry } from '@/lib/report'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /platform/report/list:
 *   get:
 *     operationId: listPlatformReports
 *     summary: Retrieve a list of available reports
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
 *     responses:
 *       200:
 *         description: The list of reports was retrieved successfully
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
 *                         properties: {}
 *               required:
 *                 - items
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
 *                       $ref: '#/paths/~1platform~1report~1list/get/responses/200/content/application~1json/schema/properties/items/items'
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
          items: makeJsonSafe([]),
        }
      }

      return {
        items: makeJsonSafe(
          Object.entries(registry).map(([id, report]) => ({
            id: id,

            name: report.name,
            description: report.description,

            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
          }))
        ),
      }
    })
  )
)

/**
 * @manual Reports
 * @index 100
 *
 * ## Discovering Available Reports
 *
 * Before generating a report, you need to know which reports are available on
 * the platform. The list endpoint provides a complete catalog of all report
 * types you can access, including their identifiers, names, and descriptions.
 *
 * Each report in the registry has a unique identifier (ID) that you use when
 * fetching the actual report data. The list endpoint returns metadata about
 * each report without executing any analytics queries, making it a lightweight
 * operation suitable for building user interfaces or documentation.
 *
 * ```http
 * GET /api/v1/platform/report/list
 * ```
 *
 * The response includes an array of report objects, each containing the report
 * ID, a human-readable name, a description of what the report measures, and
 * timestamp information indicating when the report type was created and last
 * updated.
 *
 * ```javascript
 * {
 *   "items": [
 *     {
 *       "id": "clr3m5n8k000008jq7h9e5b1a",
 *       "name": "Total Ratings Report",
 *       "description": "Comprehensive report on total number of ratings received",
 *       "createdAt": "2025-11-17T00:00:00.000Z",
 *       "updatedAt": "2025-11-17T00:00:00.000Z"
 *     },
 *     {
 *       "id": "clr3m5n8k000108jq3c4d7f2b",
 *       "name": "Thumbs Up Report",
 *       "description": "Report on positive ratings received",
 *       "createdAt": "2025-11-17T00:00:00.000Z",
 *       "updatedAt": "2025-11-17T00:00:00.000Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Use the `id` field from the list response when making requests to the fetch
 * endpoint to generate specific reports. The descriptive information helps you
 * understand what each report measures and choose the appropriate reports for
 * your analytics needs.
 *
 * This endpoint is particularly useful when building dynamic dashboards or
 * administrative interfaces where users need to select from available report
 * types. You can cache the list of reports since new report types are only
 * added during platform updates.
 */
