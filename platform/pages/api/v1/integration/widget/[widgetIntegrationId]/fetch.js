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
 * /integration/widget/{widgetIntegrationId}/fetch:
 *   get:
 *     operationId: fetchWidgetIntegration
 *     summary: Fetch a widgetIntegration
 *     tags:
 *       - Widget Integration
 *     parameters:
 *       - in: path
 *         name: widgetIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Widget integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Widget integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - type: object
 *                   properties:
 *                     theme:
 *                       description: The theme of the Widget integration
 *                       type: string
 *                     layout:
 *                       description: The default layout of the Widget integration
 *                       type: string
 *                     title:
 *                       description: The title of the Widget integration
 *                       type: string
 *                     intro:
 *                       description: The intro of the Widget integration
 *                       type: string
 *                     initial:
 *                       description: The initial message of the Widget integration
 *                       type: string
 *                     placeholder:
 *                       description: The input placeholder of the Widget integration
 *                       type: string
 *                     origin:
 *                       description: The origin URLs of the Widget integration
 *                       type: string
 *                     sessionDuration:
 *                       description: The session duration of the Widget integration
 *                       type: number
 *                     language:
 *                       description: The language of the Widget integration
 *                       type: string
 *                     plugins:
 *                       description: The plugins of the Widget integration
 *                       type: string
 *                     stream:
 *                       description: Whether the Widget integration is streaming
 *                       type: boolean
 *                     verbose:
 *                       description: Whether the Widget integration is verbose
 *                       type: boolean
 *                     tools:
 *                       description: Whether the Widget integration has tools
 *                       type: boolean
 *                     unfurl:
 *                       description: Whether the Widget integration unfurls links
 *                       type: boolean
 *                     math:
 *                       description: Whether the Widget integration supports math
 *                       type: boolean
 *                     carousel:
 *                       description: Whether the Widget integration supports carousels
 *                       type: boolean
 *                     form:
 *                       description: Whether the Widget integration supports forms
 *                       type: boolean
 *                     attachments:
 *                       description: Whether the Widget integration supports attachments
 *                       type: boolean
 *                     autoScroll:
 *                       description: Whether the Widget integration auto scrolls
 *                       type: boolean
 *                     startFirst:
 *                       description: Whether the Widget integration starts first
 *                       type: boolean
 *                     contactCollection:
 *                       description: Whether the Widget integration collects contacts
 *                       type: boolean
 *                     exportConversation:
 *                       description: Controls whether the Widget allows exporting the current conversation
 *                       type: boolean
 *                     restartConversation:
 *                       description: Controls whether the Widget allows restarting the conversation
 *                       type: boolean
 *                     maximize:
 *                       description: Controls whether the Widget allows maximizing the conversation
 *                       type: boolean
 *                     messagePeek:
 *                       description: Controls whether the Widget allows peeking at the initial messages
 *                       type: boolean
 *                     voiceIn:
 *                       description: Whether the Widget integration supports voice input
 *                       type: boolean
 *                     voiceOut:
 *                       description: Whether the Widget integration supports voice output
 *                       type: boolean
 *                     poweredBy:
 *                       description: Whether the Widget integration displays powered by
 *                       type: boolean
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const widgetIntegration =
      await prisma.widgetIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'widgetIntegrationId'),
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
        }
      )

    if (!widgetIntegration) {
      return notFound()
    }

    if (widgetIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (widgetIntegration).userId)

    return ok(makeJsonSafe(widgetIntegration))
  })
)

/**
 * @manual Widget Integration
 *
 * ## Fetching Widget Integration Details
 *
 * Retrieving widget integration details provides comprehensive information
 * about a specific widget's configuration, settings, and current state. This
 * is essential for displaying widget settings in your application, debugging
 * configuration issues, or programmatically managing widget properties based
 * on their current values.
 *
 * The fetch operation returns the complete widget configuration including all
 * appearance settings, feature flags, behavioral controls, and metadata. This
 * allows you to inspect the widget's current state before making updates or
 * to display configuration information to users managing the widget.
 *
 * ```http
 * GET /api/v1/integration/widget/{widgetIntegrationId}/fetch
 * ```
 *
 * ### Response Structure
 *
 * The response includes comprehensive widget information organized into
 * several categories:
 *
 * **Identification**: The widget's unique ID, name, and description that
 * identify and describe the widget instance.
 *
 * **Resource Linking**: References to connected resources including the
 * `botId` (associated conversational bot) and `blueprintId` (configuration
 * template if using blueprints for centralized management).
 *
 * **Appearance Configuration**: Visual and interface settings including
 * `theme` (color scheme), `layout` (interface structure), `title` (header
 * text), `intro` (welcome message), `initial` (first automated message),
 * `placeholder` (input hint text), and `language` (interface language).
 *
 * **Feature Flags**: Boolean settings that enable or disable specific
 * capabilities such as `attachments`, `voiceIn`, `voiceOut`, `form`,
 * `carousel`, `math`, `unfurl`, `contactCollection`, `exportConversation`,
 * `restartConversation`, `maximize`, `messagePeek`, and `poweredBy` branding.
 *
 * **Behavioral Settings**: Configuration that controls widget behavior
 * including `sessionDuration` (conversation persistence time), `stream`
 * (real-time response streaming), `verbose` (detailed logging), `tools`
 * (enable tool usage), `autoScroll` (automatic scrolling), and `startFirst`
 * (auto-initiate conversations).
 *
 * **Security Settings**: The `origin` parameter that restricts which domains
 * can embed and use the widget, providing security through domain whitelisting.
 *
 * ### Use Cases
 *
 * Fetching widget details is valuable for several scenarios:
 *
 * **Configuration Management**: Retrieve current settings before making updates
 * to ensure you only change specific parameters while preserving others.
 *
 * **Dashboard Display**: Show widget configuration in management interfaces
 * so users can review and understand their widget settings.
 *
 * **Conditional Updates**: Check current feature flags or settings before
 * applying conditional logic or updates based on the widget's state.
 *
 * **Troubleshooting**: Inspect widget configuration when debugging issues with
 * appearance, behavior, or feature availability to identify misconfigurations.
 *
 * **Audit and Compliance**: Review widget settings for security compliance,
 * ensuring appropriate features are enabled or disabled based on requirements.
 */
