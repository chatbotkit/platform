// @ts-check
// @todo document this api
import { timePlusDays } from '@chatbotkit-dev/time'

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

export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const usage = await prisma.usage.findMany({
        where: {
          AND: [
            {
              userId: session.user.id,
            },

            {
              createdAt: { gte: timePlusDays(-90) }, // @todo maybe make this configurable
            },

            ...getMetaQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // resource linking

          conversationId: true,
          messageId: true,
          taskId: true,
          contactId: true,
          blueprintId: true,
          botId: true,
          datasetId: true,
          skillsetId: true,
          abilityId: true,

          // resource specific

          type: true,
          count: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(usage).map(({ meta, ...rest }) => {
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
 * @manual Usage
 * @index 30
 *
 * ## Exporting Usage Records
 *
 * Export individual usage records for advanced analysis and integration with
 * external analytics systems. Unlike the standard listing endpoint, the export
 * endpoint formats response data with support for YAML metadata rendering and
 * is optimized for bulk retrieval and downstream processing.
 *
 * Usage exports provide detailed records of all platform resource consumption
 * over the past 90 days, helping you understand spending patterns, identify
 * high-usage resources, and correlate consumption with specific conversations,
 * bots, abilities, and other platform entities. Each record captures the type
 * of usage, the count of units consumed, linked resources, and custom metadata.
 *
 * ```http
 * GET /api/v1/usage/export
 * ```
 *
 * ### Pagination and Filtering
 *
 * Results are returned using cursor-based pagination. Include the `cursor` value
 * from a previous response to fetch the next page. Control the page size with
 * the `take` parameter and sort direction with `order` (`asc` or `desc`).
 *
 * You can narrow results to specific platform resources using filter parameters:
 *
 * ```http
 * GET /api/v1/usage/export?botId=bot_abc123&take=100
 * GET /api/v1/usage/export?type=conversation%2Fcomplete&order=asc
 * GET /api/v1/usage/export?skillsetId=skillset_xyz789
 * ```
 *
 * Supported filter fields include `type`, `conversationId`, `messageId`,
 * `taskId`, `contactId`, `blueprintId`, `botId`, `datasetId`, `skillsetId`,
 * and `abilityId`.
 *
 * ### Record Metadata
 *
 * Usage records include a `meta` field containing custom metadata in YAML format.
 * When processing exported records, call `.toString()` on the meta object to
 * serialize nested metadata as YAML:
 *
 * ```javascript
 * const record = response.items[0]
 * const yamlMetadata = record.meta.toString() // Returns YAML string
 * ```
 *
 * ### Retention and Limitations
 *
 * Usage data is retained for the past 90 days. Records older than 90 days are
 * automatically archived and will not appear in export results. For historical
 * analysis beyond 90 days, use your billing statements or contact support.
 *
 * **Note:** Export data is immutable. Records are created automatically by the
 * platform and cannot be modified or deleted via the API. Use this endpoint
 * for monitoring, auditing, and analytics purposes.
 */
