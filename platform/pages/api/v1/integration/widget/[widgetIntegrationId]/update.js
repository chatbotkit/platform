// @ts-check
import { WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS } from '@/config/widget'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import themeSchema from '@/schemas/theme'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  theme: themeSchema,

  layout: schema.string().allow(null, ''), // @todo more specific validation required

  title: schema.string().allow(null, ''),

  intro: schema.string().allow(null, ''),

  initial: schema.string().allow(null, ''),

  placeholder: schema.string().allow(null, ''),

  origin: schema.string().allow(null, ''),

  sessionDuration: schema
    .number()
    .min(0)
    .max(WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS)
    .allow(null),

  language: schema.string().allow(null, ''),

  plugins: schema.string().allow(null, ''), // @todo more specific validation required

  stream: schema.boolean(),

  verbose: schema.boolean(),

  tools: schema.boolean(),

  unfurl: schema.boolean(),

  math: schema.boolean(),

  carousel: schema.boolean(),

  form: schema.boolean(),

  attachments: schema.boolean(),

  autoScroll: schema.boolean(),

  startFirst: schema.boolean(),

  contactCollection: schema.boolean(),

  exportConversation: schema.boolean(),
  restartConversation: schema.boolean(),

  maximize: schema.boolean(),

  messagePeek: schema.boolean(),

  voiceIn: schema.boolean(),
  voiceOut: schema.boolean(),

  poweredBy: schema.boolean(),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/update:
 *   post:
 *     operationId: updateWidgetIntegration
 *     summary: Update a Widget integration
 *     tags:
 *       - Widget Integration
 *     parameters:
 *       - in: path
 *         name: widgetIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Widget integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - $ref: '#/components/schemas/BotRef'
 *               - type: object
 *                 properties:
 *                   theme:
 *                     description: The theme of the Widget integration
 *                     type: string
 *                   layout:
 *                     description: The default layout of the Widget integration
 *                     type: string
 *                   title:
 *                     description: The title of the Widget integration
 *                     type: string
 *                   intro:
 *                     description: The intro of the Widget integration
 *                     type: string
 *                   initial:
 *                     description: The initial message of the Widget integration
 *                     type: string
 *                   placeholder:
 *                     description: The input placeholder of the Widget integration
 *                     type: string
 *                   origin:
 *                     description: The origin URLs of the Widget integration
 *                     type: string
 *                   sessionDuration:
 *                     description: The session duration of the Widget integration
 *                     type: number
 *                   language:
 *                     description: The language of the Widget integration
 *                     type: string
 *                   plugins:
 *                     description: The plugins of the Widget integration
 *                     type: string
 *                   stream:
 *                     description: Whether the Widget integration is streaming
 *                     type: boolean
 *                   verbose:
 *                     description: Whether the Widget integration is verbose
 *                     type: boolean
 *                   tools:
 *                     description: Whether the Widget integration has tools
 *                     type: boolean
 *                   unfurl:
 *                     description: Whether the Widget integration unfurls links
 *                     type: boolean
 *                   math:
 *                     description: Whether the Widget integration supports math
 *                     type: boolean
 *                   carousel:
 *                     description: Whether the Widget integration supports carousels
 *                     type: boolean
 *                   form:
 *                     description: Whether the Widget integration supports forms
 *                     type: boolean
 *                   attachments:
 *                     description: Whether the Widget integration supports attachments
 *                     type: boolean
 *                   autoScroll:
 *                     description: Whether the Widget integration auto scrolls
 *                     type: boolean
 *                   startFirst:
 *                     description: Whether the Widget integration starts first
 *                     type: boolean
 *                   contactCollection:
 *                     description: Whether the Widget integration collects contacts
 *                     type: boolean
 *                   exportConversation:
 *                     description: Controls whether the Widget allows exporting the current conversation
 *                     type: boolean
 *                   restartConversation:
 *                     description: Controls whether the Widget allows restarting the conversation
 *                     type: boolean
 *                   maximize:
 *                     description: Controls whether the Widget allows maximizing the conversation
 *                     type: boolean
 *                   messagePeek:
 *                     description: Controls whether the Widget allows peeking at the initial messages
 *                     type: boolean
 *                   voiceIn:
 *                     description: Controls whether the Widget allows voice input
 *                     type: boolean
 *                   voiceOut:
 *                     description: Controls whether the Widget allows voice output
 *                     type: boolean
 *                   poweredBy:
 *                     description: Whether the Widget integration displays powered by
 *                     type: boolean
 *     responses:
 *       200:
 *         description: The Widget integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Widget Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        theme,

        layout,

        title,

        intro,

        initial,

        placeholder,

        origin,

        sessionDuration,

        language,

        plugins,

        stream,

        verbose,

        tools,

        unfurl,

        math,

        carousel,

        form,

        attachments,

        autoScroll,

        startFirst,

        contactCollection,

        exportConversation,
        restartConversation,

        maximize,

        messagePeek,

        voiceIn,
        voiceOut,

        poweredBy,

        meta,
      } = body

      const widgetIntegration =
        await prisma.widgetIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'widgetIntegrationId')
        )

      if (!widgetIntegration) {
        return notFound()
      }

      if (widgetIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.widgetIntegration.update({
        where: {
          id: widgetIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          theme,

          layout,

          title,

          intro,

          initial,

          placeholder,

          origin,

          sessionDuration,

          language,

          plugins,

          stream,

          verbose,

          tools,

          unfurl,

          math,

          carousel,

          form,

          attachments,

          autoScroll,

          startFirst,

          contactCollection,

          exportConversation,
          restartConversation,

          maximize,

          messagePeek,

          voiceIn,
          voiceOut,

          poweredBy,

          // meta and others

          meta: getMeta(meta, widgetIntegration.meta),
        },
      })

      // @todo invalidate the cache for some URLs

      return ok({ id: widgetIntegration.id })
    })
  )
)

/**
 * @manual Widget Integration
 *
 * ## Updating Widget Integrations
 *
 * Updating a widget integration allows you to modify its configuration,
 * appearance, behavior, and feature settings without recreating the widget.
 * This is essential for iterating on your chat widget design, adjusting
 * user experience settings, and enabling or disabling features based on
 * your evolving requirements.
 *
 * Widget integrations support extensive customization options including
 * visual themes, conversational behavior, feature toggles, and user
 * interaction controls. You can update the connected bot, modify the
 * interface text and styling, configure session settings, and control
 * which features are available to your users.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Support Widget",
 *   "description": "Enhanced customer support chat interface",
 *   "botId": "bot_xyz789",
 *   "theme": "dark",
 *   "title": "How can we help you?",
 *   "intro": "Welcome! Ask us anything about our products and services.",
 *   "contactCollection": true,
 *   "voiceIn": true,
 *   "voiceOut": true,
 *   "attachments": true,
 *   "exportConversation": true
 * }
 * ```
 *
 * ### Configuration Options
 *
 * The widget update endpoint supports numerous configuration parameters
 * that control every aspect of the widget's appearance and functionality:
 *
 * **Appearance Settings**: Control the visual presentation with `theme`
 * (color scheme), `layout` (interface arrangement), `title` (header text),
 * `intro` (welcome message), and `placeholder` (input field hint text).
 *
 * **Behavioral Settings**: Configure session behavior with `sessionDuration`
 * to control how long conversations persist, `startFirst` to automatically
 * initiate conversations, and `autoScroll` to manage message scrolling behavior.
 *
 * **Feature Toggles**: Enable or disable specific capabilities including
 * `attachments` (file uploads), `voiceIn` (speech input), `voiceOut` (audio
 * responses), `form` (form rendering), `carousel` (carousel messages),
 * `math` (mathematical expressions), and `unfurl` (link previews).
 *
 * **User Controls**: Manage user-facing controls such as `contactCollection`
 * (collect user contact information), `exportConversation` (allow conversation
 * downloads), `restartConversation` (enable conversation reset), `maximize`
 * (fullscreen mode), and `messagePeek` (preview initial messages).
 *
 * **Technical Settings**: Configure technical aspects like `stream` (enable
 * streaming responses), `verbose` (detailed logging), `tools` (enable tool
 * usage), `language` (interface language), and `origin` (allowed domains
 * for security).
 *
 * ### Important Considerations
 *
 * **Domain Security**: The `origin` parameter controls which domains can
 * embed and use your widget. Configure this carefully to prevent unauthorized
 * use and ensure your widget only appears on approved websites.
 *
 * **Session Duration**: The `sessionDuration` parameter has a maximum limit
 * of one hour. Longer sessions may impact performance and resource usage,
 * while shorter sessions ensure fresher conversation contexts.
 *
 * **Blueprint Inheritance**: If you update the `blueprintId`, the widget
 * will inherit configuration from the new blueprint. This allows you to
 * manage multiple widgets with shared settings through blueprint updates.
 *
 * **Feature Dependencies**: Some features have dependencies on others. For
 * example, voice features require browser support, and forms require specific
 * bot configurations. Test thoroughly when enabling new features.
 */
