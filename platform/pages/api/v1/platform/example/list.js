// @ts-check
import { withStreamCursor } from '@/lib/stream'

import { getExternalHostURL } from '@/lib/host'

import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'

import examplesData from '@/examples'

/**
 * @swagger
 *
 * /platform/example/list:
 *   get:
 *     operationId: listPlatformExamples
 *     summary: Retrieve a list of platform examples
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
 *         description: The list of examples was retrieved successfully
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
 *                           type:
 *                             description: The type of the example
 *                             type: string
 *                             enum:
 *                               - blueprint
 *                               - project
 *                               - widget
 *                               - slack
 *                               - discord
 *                               - whatsapp
 *                               - messenger
 *                               - telegram
 *                               - twilio
 *                               - email
 *                               - trigger
 *                           tags:
 *                             description: Tags associated with the example
 *                             type: array
 *                             items:
 *                               type: string
 *                           link:
 *                            description: The URL to the official example page
 *                            type: string
 *                         required:
 *                           - name
 *                           - description
 *                           - type
 *                           - link
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
 *                       $ref: '#/paths/~1platform~1example~1list/get/responses/200/content/application~1json/schema/properties/items/items'
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
          items: [],
        }
      }

      return {
        items: examplesData.map((example) => {
          const isBlueprint = example.blueprint !== undefined
          const isProject = Array.isArray(example.files)

          return {
            id: example.slug,

            name: example.title,
            description: example.description,

            type: isBlueprint
              ? 'blueprint'
              : isProject
                ? 'project'
                : example.integration || 'widget',

            tags: example.keywords,

            // @todo improve DRYness here

            link: getExternalHostURL(`/examples/${example.slug}`),

            createdAt: example.date
              ? new Date(example.date).getTime()
              : Date.now(),
            updatedAt: example.date
              ? new Date(example.date).getTime()
              : Date.now(),
          }
        }),
      }
    })
  )
)

/**
 * @manual Platform Examples
 * @description Examples are pre-built templates and configurations that demonstrate common conversational AI use cases, providing starting points for building your own applications.
 * @category Platform
 * @tags examples, templates, blueprints, integrations
 * @index 20
 *
 * Examples serve as both educational resources and practical starting points
 * for building conversational AI applications. Each example demonstrates a
 * specific use case, integration pattern, or application type, complete with
 * pre-configured settings and best practices baked in.
 *
 * ## Browsing Available Examples
 *
 * The platform maintains a curated library of examples covering various
 * integration types, industries, and use cases:
 *
 * ```http
 * GET /api/v1/platform/example/list
 * ```
 *
 * Each example includes:
 *
 * - **id**: Unique slug identifier for the example
 - **name**: Descriptive title of the example
 - **description**: Overview of what the example demonstrates
 - **type**: The integration or application type (blueprint, project, widget, slack, discord, etc.)
 - **tags**: Searchable tags for discovering relevant examples
 *
 * ## Example Types
 *
 * Examples are categorized by their integration or deployment type:
 *
 * - **blueprint**: Complete agent configurations that can be deployed across channels
 * - **project**: Full SDK code examples demonstrating integration patterns
 * - **widget**: Web-embeddable chat widgets with specific styling and behavior
 * - **slack**: Slack bot configurations and integration patterns
 * - **discord**: Discord bot templates and community management examples
 * - **whatsapp**: WhatsApp Business integration examples
 * - **messenger**: Facebook Messenger bot configurations
 * - **telegram**: Telegram bot templates
 * - **twilio**: SMS and voice-based conversational examples
 * - **email**: Email-based conversational automation
 * - **trigger**: Event-driven automation patterns
 *
 * ```javascript
 * {
 *   "id": "customer-support-assistant",
   "name": "Customer Support Assistant",
   "description": "AI assistant for handling common customer inquiries",
   "type": "blueprint",
   "tags": ["support", "customer-service", "helpdesk"],
   "createdAt": 1700000000000,
 *   "updatedAt": 1700000000000
 * }
 * ```
 *
 * ## Using Examples as Templates
 *
 * Examples are designed to be starting points that you can customize for your
 * specific needs. The list endpoint provides lightweight metadata to help you
 * browse and discover available examples. Common use cases include:
 *
 * - Browsing all available example templates
 * - Discovering examples by type or category
 * - Building example selection interfaces
 * - Syncing example metadata to external systems
 *
 * Each example represents tested, working configurations that demonstrate
 * best practices for specific use cases, integration patterns, or industries.
 */
