// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import yaml from '@/lib/yaml'

/**
 * -@swagger
 *
 * /event/metric/export:
 *   get:
 *     operationId: exportEventMetrics
 *     summary: Export event metrics
 *     tags:
 *       - Event
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
 *       - in: query
 *         name: type
 *         schema:
 *           description: Filter by metric type
 *           type: string
 *     responses:
 *       200:
 *         description: The list of metrics was exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 *                       $ref: '#/paths/~1metric~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const metrics = await prisma.eventMetric.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').EventMetric>} */ (
              getFieldQueryFilter
            )(req, [
              'type',
              'conversationId',
              'taskId',
              'contactId',
              'blueprintId',
              'botId',
              'datasetId',
              'recordId',
              'skillsetId',
              'abilityId',
              'fileId',
              'secretId',
              'portalId',
              'widgetIntegrationId',
              'slackIntegrationId',
              'githubIntegrationId',
              'discordIntegrationId',
              'microsoftteamsIntegrationId',
              'googlechatIntegrationId',
              'whatsappIntegrationId',
              'messengerIntegrationId',
              'instagramIntegrationId',
              'telegramIntegrationId',
              'twilioIntegrationId',
              'emailIntegrationId',
              'sitemapIntegrationId',
              'notionIntegrationId',
              'triggerIntegrationId',
              'supportIntegrationId',
              'extractIntegrationId',
              'mcpserverIntegrationId',
              'skillserverIntegrationId',
              // @todo enable when anam/avatar/recall emit events (add the
              // EventLog/EventMetric column + a logEvent relation first)
              // 'anamIntegrationId',
              // 'avatarIntegrationId',
              // 'recallIntegrationId',
              'webhookId',
            ]),
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

          // resource linking

          conversationId: true,

          taskId: true,

          contactId: true,

          blueprintId: true,

          botId: true,

          datasetId: true,

          recordId: true,

          skillsetId: true,

          abilityId: true,

          fileId: true,

          secretId: true,

          portalId: true,

          widgetIntegrationId: true,

          slackIntegrationId: true,
          githubIntegrationId: true,

          discordIntegrationId: true,

          microsoftteamsIntegrationId: true,

          googlechatIntegrationId: true,

          whatsappIntegrationId: true,

          messengerIntegrationId: true,
          instagramIntegrationId: true,

          telegramIntegrationId: true,

          twilioIntegrationId: true,

          emailIntegrationId: true,

          sitemapIntegrationId: true,

          notionIntegrationId: true,

          triggerIntegrationId: true,

          supportIntegrationId: true,

          extractIntegrationId: true,

          mcpserverIntegrationId: true,
          skillserverIntegrationId: true,
          // @todo enable alongside the whitelist entries above
          // anamIntegrationId: true,
          // avatarIntegrationId: true,
          // recallIntegrationId: true,

          webhookId: true,

          // resource specific

          type: true,

          value: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(metrics).map(({ meta, ...rest }) => {
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
