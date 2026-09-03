// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /contact/export:
 *   get:
 *     operationId: exportContacts
 *     summary: Export contacts
 *     tags:
 *       - Contact
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
 *         description: The list of contacts was retrieved successfully
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
 *                           fingerprint:
 *                             description: The fingerprint of the contact
 *                             type: string
 *                           email:
 *                             description: The email address of the contact
 *                             type: string
 *                           phone:
 *                             description: The phone number of the contact
 *                             type: string
 *                           nick:
 *                             description: The nickname of the contact
 *                             type: string
 *                           preferences:
 *                             description: The preferences of the contact
 *                             type: string
 *                           verifiedAt:
 *                             description: The timestamp (ms) when the contact was verified
 *                             type: number
 *                         required:
 *                           - fingerprint
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
 *                       $ref: '#/paths/~1contact~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const contacts = await prisma.contact.findMany({
        where: {
          AND: [
            {
              userId: session.user.id,
            },

            // @todo maybe restrict by date range

            ...getMetaQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource specific

          fingerprint: true,

          email: true,
          phone: true,

          nick: true,

          preferences: true,

          verifiedAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(contacts).map(({ meta, ...rest }) => {
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
 * @manual Contacts
 *
 * ## Exporting Contacts
 *
 * The export contacts operation provides specialized functionality for
 * retrieving contact data in formats optimized for data migration, backup,
 * analysis, or integration with external systems. Unlike the standard list
 * endpoint, the export endpoint supports multiple response formats including
 * JSON, JSONL (JSON Lines for streaming), and CSV, making it ideal for bulk
 * data operations and system integrations.
 *
 * This endpoint is particularly useful when you need to synchronize your
 * contact database with external CRM systems, perform data analysis in
 * spreadsheet applications, create backups of your contact data, or migrate
 * contacts between different environments. The flexible format support ensures
 * compatibility with a wide range of downstream tools and processes.
 *
 * The export operation supports the same pagination and filtering capabilities
 * as the list endpoint, but with enhanced metadata serialization. When
 * exporting to CSV format, complex metadata objects are automatically
 * converted to YAML strings, ensuring all data is preserved in a human-
 * readable format suitable for spreadsheet applications.
 *
 * ```http
 * GET /api/v1/contact/export
 * Accept: application/json
 * ```
 *
 * For CSV export (ideal for Excel or Google Sheets):
 *
 * ```http
 * GET /api/v1/contact/export
 * Accept: text/csv
 * ```
 *
 * For streaming large datasets efficiently using JSONL format:
 *
 * ```http
 * GET /api/v1/contact/export
 * Accept: application/jsonl
 * ```
 *
 * The JSONL format is particularly efficient for large datasets as it streams
 * one contact per line, allowing you to process records incrementally without
 * loading the entire dataset into memory. This approach is ideal for ETL
 * (Extract, Transform, Load) pipelines and data synchronization processes.
 *
 * You can combine export with metadata filters to export specific segments of
 * your contact database:
 *
 * ```http
 * GET /api/v1/contact/export?meta.verified=true
 * Accept: text/csv
 * ```
 *
 * **Rate Limiting:** Export operations may be subject to rate limiting to
 * ensure system stability. For very large contact databases (millions of
 * records), consider using pagination with cursor-based iteration and
 * implement exponential backoff if you encounter rate limit responses.
 *
 * **Data Privacy:** Exported contact data contains personally identifiable
 * information (PII). Ensure you handle exported files securely and comply with
 * relevant data protection regulations such as GDPR, CCPA, or other applicable
 * privacy laws in your jurisdiction.
 */
