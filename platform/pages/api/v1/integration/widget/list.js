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
 * /integration/widget/list:
 *   get:
 *     operationId: listWidgetIntegrations
 *     summary: List Widget integrations
 *     tags:
 *       - Widget Integration
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
 *         description: The list of Widget integrations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BotRef'
 *                       - type: object
 *                         properties:
 *                           theme:
 *                             description: The theme of the Widget integration
 *                             type: string
 *                           layout:
 *                             description: The default layout of the Widget integration
 *                             type: string
 *                           title:
 *                             description: The title of the Widget integration
 *                             type: string
 *                           intro:
 *                             description: The intro of the Widget integration
 *                             type: string
 *                           initial:
 *                             description: The initial message of the Widget integration
 *                             type: string
 *                           placeholder:
 *                             description: The input placeholder of the Widget integration
 *                             type: string
 *                           origin:
 *                             description: The origin URLs of the Widget integration
 *                             type: string
 *                           sessionDuration:
 *                             description: The session duration of the Widget integration
 *                             type: number
 *                           language:
 *                             description: The language of the Widget integration
 *                             type: string
 *                           plugins:
 *                             description: The plugins of the Widget integration
 *                             type: string
 *                           stream:
 *                             description: Whether the Widget integration is streaming
 *                             type: boolean
 *                           verbose:
 *                             description: Whether the Widget integration is verbose
 *                             type: boolean
 *                           tools:
 *                             description: Whether the Widget integration has tools
 *                             type: boolean
 *                           unfurl:
 *                             description: Whether the Widget integration unfurls links
 *                             type: boolean
 *                           math:
 *                             description: Weather the Widget integration supports math
 *                             type: boolean
 *                           carousel:
 *                             description: Weather the Widget integration supports carousels
 *                             type: boolean
 *                           form:
 *                             description: Weather the Widget integration supports forms
 *                             type: boolean
 *                           attachments:
 *                             description: Weather the Widget integration supports attachments
 *                             type: boolean
 *                           autoScroll:
 *                             description: Whether the Widget integration auto scrolls
 *                             type: boolean
 *                           startFirst:
 *                             description: Whether the Widget integration starts first
 *                             type: boolean
 *                           contactCollection:
 *                             description: Whether the Widget integration collects contacts
 *                             type: boolean
 *                           exportConversation:
 *                             description: Controls whether the Widget allows exporting the current conversation
 *                             type: boolean
 *                           restartConversation:
 *                             description: Controls whether the Widget allows restarting the conversation
 *                             type: boolean
 *                           maximize:
 *                             description: Controls whether the Widget allows maximizing the conversation
 *                             type: boolean
 *                           messagePeek:
 *                             description: Controls whether the Widget allows peeking at the initial messages
 *                             type: boolean
 *                           voiceIn:
 *                             description: Whether the Widget integration supports voice input
 *                             type: boolean
 *                           voiceOut:
 *                             description: Whether the Widget integration supports voice output
 *                             type: boolean
 *                           poweredBy:
 *                             description: Whether the Widget integration displays powered by
 *                             type: boolean
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
 *                       $ref: '#/paths/~1integration~1widget~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const widgetIntegrations = await prisma.widgetIntegration.findMany({
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

          botId: true,

          // resource specific: options

          theme: true,

          layout: true,

          title: true,

          intro: true,

          initial: true,

          placeholder: true,

          origin: true,

          sessionDuration: true,

          language: true,

          plugins: true,

          stream: true,

          verbose: true,

          tools: true,

          unfurl: true,

          math: true,

          carousel: true,

          form: true,

          attachments: true,

          autoScroll: true,

          startFirst: true,

          contactCollection: true,

          exportConversation: true,
          restartConversation: true,

          maximize: true,

          messagePeek: true,

          voiceIn: true,
          voiceOut: true,

          poweredBy: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(widgetIntegrations),
      }
    })
  )
)

/**
 * @manual Widget Integration
 * @category Integrations
 * @index 20
 *
 * ## Listing Widget Integrations
 *
 * You can retrieve a list of all your widget integrations to manage deployed
 * chat interfaces, review configuration settings, and monitor which widgets
 * are active across your web properties. The list endpoint provides
 * comprehensive information about each widget, including customization
 * settings, feature flags, and resource associations.
 *
 * ```http
 * GET /api/v1/integration/widget/list
 * ```
 *
 * This endpoint returns all widget integrations associated with your account,
 * ordered by creation date with the most recent widgets appearing first. Each
 * widget in the response includes its complete configuration, making it easy
 * to audit settings or prepare for updates.
 *
 * ### Pagination and Filtering
 *
 * For accounts with many widget integrations, the API supports cursor-based
 * pagination to efficiently retrieve large result sets. You can also filter
 * widgets by metadata or blueprint association to find specific integrations
 * quickly.
 *
 * ```http
 * GET /api/v1/integration/widget/list?take=10&cursor={nextCursor}
 * ```
 *
 * The `take` parameter controls how many widgets to retrieve in a single
 * request, defaulting to a reasonable page size. The `cursor` parameter
 * enables sequential navigation through your complete widget collection.
 *
 * ### Response Structure
 *
 * Each widget in the response includes comprehensive configuration details:
 *
 * - **Basic Information**: Name, description, and identification
 * - **Appearance**: Theme, layout, title, intro message, and placeholder text
 * - **Behavior**: Session duration, language, streaming, and auto-scroll
 * - **Features**: Attachments, voice input/output, forms, math rendering
 * - **Controls**: Export, restart, maximize, and message peek options
 * - **Branding**: Powered-by display and origin restrictions
 * - **Resources**: Associated bot and blueprint references
 *
 * Use the response data to build management interfaces, audit widget
 * configurations, or synchronize settings across multiple widgets. The
 * complete configuration data ensures you have full visibility into how each
 * widget is configured and deployed.
 *
 * **Metadata Filtering**: Include the `meta` query parameter to filter
 * widgets by custom metadata key-value pairs. This is particularly useful
 * when you've organized widgets using metadata tags for different clients,
 * projects, or deployment environments.
 */
